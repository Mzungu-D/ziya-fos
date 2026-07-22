const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: 'b2aa1d001@smtp-brevo.com',
    pass: 'xsmtpsib-1a647ddd1f858bd2cd5e115f77bf9c723cd7bbccca387348c430810b1ea5983a-u1JqfzyyNLrZbdRY',
  },
});

transporter.sendMail({
  from: '"Ziya FOS" <dennisodhiambo34@gmail.com>',
  to: 'dennisodhiambo34@gmail.com',
  subject: 'Ziya FOS Test',
  html: '<h1>Test OTP: 123456</h1>',
}).then(info => {
  console.log('SUCCESS - Email sent:', info.messageId);
}).catch(err => {
  console.error('FAILED - Error:', err.message);
});