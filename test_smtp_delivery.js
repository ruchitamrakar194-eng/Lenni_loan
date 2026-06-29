const nodemailer = require('nodemailer');
const dns = require('dns').promises;

async function checkDns() {
  console.log("=== Checking DNS for lenni.co.za ===");
  try {
    const spf = await dns.resolveTxt('lenni.co.za');
    console.log("SPF Records:", spf);
  } catch (e) {
    console.log("SPF Error:", e.message);
  }
  try {
    const dmarc = await dns.resolveTxt('_dmarc.lenni.co.za');
    console.log("DMARC Records:", dmarc);
  } catch (e) {
    console.log("DMARC Error:", e.message);
  }
}

async function testSmtp() {
  console.log("\n=== Testing SMTP Connection ===");
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'lms@lenni.co.za',
      pass: 'bgoi vmsi byua vzfv'
    }
  });

  try {
    await transporter.verify();
    console.log("SMTP Verified Successfully.");
    
    console.log("\n=== Sending Test Email ===");
    // We send a test email to the sender's own address. If it doesn't arrive there, there's a big problem.
    const info = await transporter.sendMail({
      from: '"Lenni LMS" <lms@lenni.co.za>',
      to: 'lms@lenni.co.za',
      subject: 'SMTP Delivery Test',
      text: 'This is a test email.'
    });
    console.log("SMTP Response:", info.response);
    console.log("Message ID:", info.messageId);
    console.log("Status: Accepted by Google SMTP server.");
  } catch (err) {
    console.error("SMTP Error:", err.message);
  }
}

async function run() {
  await checkDns();
  await testSmtp();
}

run();
