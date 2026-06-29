const prisma = require('../config/db');

// Upload a document
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { category, companyName, employeeName, loanRef } = req.body;

    const document = await prisma.document.create({
      data: {
        fileName: req.file.originalname || req.file.filename || 'document',
        fileUrl: req.file.path,
        fileType: req.file.mimetype || 'application/pdf',
        category: category || 'Other',
        uploadedBy: req.user.email,
        companyName: companyName || req.user.company || null,
        employeeName: employeeName || req.user.name || null,
        loanRef: loanRef || null,
        status: 'Active'
      }
    });

    // Record in audit log
    await prisma.auditlog.create({
      data: {
        action: 'DOCUMENT_UPLOAD',
        user: req.user.email,
        note: `Uploaded document: ${document.fileName} (Category: ${document.category})`
      }
    });

    res.status(201).json(document);
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ message: 'Failed to upload document' });
  }
};

// Fetch documents
exports.getDocuments = async (req, res) => {
  try {
    const { category, companyName, employeeName, search } = req.query;

    const where = {
      status: 'Active'
    };

    // If employee, only show their own documents
    if (req.user.role === 'employee') {
      where.uploadedBy = req.user.email;
    } else {
      // Admins/HR/Finance can filter
      if (category && category !== 'ALL') {
        where.category = category;
      }
      if (companyName && companyName !== 'ALL') {
        where.companyName = companyName;
      }
      if (employeeName) {
        where.employeeName = { contains: employeeName };
      }
      if (search) {
        where.OR = [
          { fileName: { contains: search } },
          { uploadedBy: { contains: search } },
          { loanRef: { contains: search } },
          { category: { contains: search } }
        ];
      }
    }

    const documents = await prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
};

// Delete a document
exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await prisma.document.findUnique({
      where: { id: parseInt(id) }
    });

    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Check authorization: employee can only delete their own
    if (req.user.role === 'employee' && doc.uploadedBy !== req.user.email) {
      return res.status(403).json({ message: 'Not authorized to delete this document' });
    }

    await prisma.document.update({
      where: { id: parseInt(id) },
      data: { status: 'Deleted' }
    });

    // Record in audit log
    await prisma.auditlog.create({
      data: {
        action: 'DOCUMENT_DELETE',
        user: req.user.email,
        note: `Purged document: ${doc.fileName}`
      }
    });

    res.json({ message: 'Document removed successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ message: 'Failed to delete document' });
  }
};

exports.sendDocumentEmail = async (req, res) => {
  try {
    const { borrowerEmail, bankEmail, documentTitle, htmlContent } = req.body;
    if (!borrowerEmail || !bankEmail) {
      return res.status(400).json({ message: 'Borrower and compliance emails are required' });
    }

    const emailService = require('../services/emailService');
    const fs = require('fs');
    const path = require('path');

    let html = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>${documentTitle}</h2>
        <p>Please find the secure document below:</p>
        <hr/>
        <div>${htmlContent || 'Document content not provided'}</div>
      </div>
    `;
    console.log("Original HTML contains /download.png?", html.includes('/download.png'));
    console.log("Original HTML contains /signature (1) (1).png?", html.includes('/signature (1) (1).png'));

    const attachments = [];
    const frontendPublicPath = path.join(__dirname, '../../LMS-frontend/public');
    
    // Parse and replace known local images with CID attachments
    if (html.includes('/download.png')) {
      const logoPath = path.join(frontendPublicPath, 'download.png');
      if (fs.existsSync(logoPath)) {
        attachments.push({
          filename: 'download.png',
          path: logoPath,
          cid: 'logo_img@lenni.co.za'
        });
        html = html.replace(/\/download\.png/g, 'cid:logo_img@lenni.co.za');
      }
    }

    if (html.includes('/signature (1) (1).png')) {
      const sigPath = path.join(frontendPublicPath, 'signature (1) (1).png');
      if (fs.existsSync(sigPath)) {
        attachments.push({
          filename: 'signature.png',
          path: sigPath,
          cid: 'sig_img@lenni.co.za'
        });
        // We use a regex that matches the spaces properly just in case
        html = html.replace(/\/signature\s*\(1\)\s*\(1\)\.png/g, 'cid:sig_img@lenni.co.za');
      }
    }

    // Send to borrower
    await emailService.sendEmailImmediate({
      to: borrowerEmail,
      subject: `Secure Document: ${documentTitle}`,
      html,
      text: `Please review the document: ${documentTitle}`,
      attachments,
      emailType: 'DOCUMENT_SHARE'
    });

    // Send to bank/compliance
    if (bankEmail && bankEmail !== borrowerEmail) {
      await emailService.sendEmailImmediate({
        to: bankEmail,
        subject: `Secure Document: ${documentTitle} (Compliance Copy)`,
        html,
        text: `Please review the document: ${documentTitle}`,
        attachments,
        emailType: 'DOCUMENT_SHARE'
      });
    }

    res.json({ message: 'Emails sent successfully' });
  } catch (error) {
    console.error('Error sending document email:', error);
    res.status(500).json({ message: 'Failed to send email: ' + error.message });
  }
};
