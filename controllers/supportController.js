const emailService = require('../services/emailService');
const prisma = require('../config/db');

exports.submitContactQuery = async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ message: 'Name, email and message are required.' });
  }

  const safeName = String(name || '');
  const safeEmail = String(email || '');
  const safeMessage = String(message || '');

  const ticketNumber = `LNS-${Math.floor(100000 + Math.random() * 900000)}`;

  try {
    // 1. Log query to auditlog table
    await prisma.auditlog.create({
      data: {
        action: 'SUPPORT_QUERY_SUBMITTED',
        user: safeEmail,
        note: (`Ticket: ${ticketNumber} | Name: ${safeName} | Message: ${safeMessage}`).substring(0, 190),
        entityId: ticketNumber
      }
    });

    // 2. Format HTML and plain text details
    const textContent = `Support Request from Lenni Website:\n\nName: ${safeName}\nEmail: ${safeEmail}\nTicket: ${ticketNumber}\n\nMessage:\n${safeMessage}`;
    
    const htmlContent = emailService.populateTemplate('notification', {
      message: `
        <h3>Lenni Support Request</h3>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
        <p><strong>Message:</strong></p>
        <p>${safeMessage.replace(/\\n/g, '<br>').replace(/\n/g, '<br>')}</p>
      `
    });

    // 3. Send email to support using the centralized lms@lenni.co.za sender
    await emailService.queueEmail({
      to: 'support@lenni.co.za',
      subject: `Lenni Support Query - Ticket ${ticketNumber}`,
      html: htmlContent,
      text: textContent,
      emailType: 'SUPPORT_QUERY',
      relatedRecord: ticketNumber
    });

    res.status(200).json({
      message: 'Support query received and routed successfully.',
      ticketNumber
    });
  } catch (error) {
    console.error('Support Query Processing Error:', error);
    res.status(500).json({ message: 'Failed to process support query. Please try again.' });
  }
};

