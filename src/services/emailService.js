const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendOTP = async (email, otp, username) => {
  try {
    await transporter.sendMail({
      from:    process.env.SMTP_FROM || 'SkillArena <noreply@skillarena.in>',
      to:      email,
      subject: `${otp} is your SkillArena verification code`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0f;color:#f0f0f5;padding:32px;border-radius:12px;border:1px solid #2a2a3a">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:28px">
            <div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,#7c3aed,#4f46e5);display:flex;align-items:center;justify-content:center">
              <span style="color:#fff;font-size:18px;font-weight:700">⚡</span>
            </div>
            <span style="font-size:20px;font-weight:700">Skill<span style="color:#8b5cf6">Arena</span></span>
          </div>
          <h2 style="font-size:22px;font-weight:700;margin-bottom:8px">Verify your email</h2>
          <p style="color:#8888aa;margin-bottom:28px">Hi ${username}, enter this code to verify your SkillArena account:</p>
          <div style="background:#111118;border:1px solid #2a2a3a;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px">
            <div style="font-size:44px;font-weight:800;letter-spacing:12px;color:#8b5cf6">${otp}</div>
          </div>
          <p style="color:#55556a;font-size:13px">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
        </div>
      `,
    });
    logger.info('OTP email sent', { email });
    return true;
  } catch (err) {
    logger.error('Email send failed', { email, error: err.message });
    return false;
  }
};

const sendWelcome = async (email, username) => {
  try {
    await transporter.sendMail({
      from:    process.env.SMTP_FROM || 'SkillArena <noreply@skillarena.in>',
      to:      email,
      subject: 'Welcome to SkillArena 🎮',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0f;color:#f0f0f5;padding:32px;border-radius:12px;border:1px solid #2a2a3a">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:28px">
            <div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,#7c3aed,#4f46e5);display:flex;align-items:center;justify-content:center">
              <span style="color:#fff;font-size:18px">⚡</span>
            </div>
            <span style="font-size:20px;font-weight:700">Skill<span style="color:#8b5cf6">Arena</span></span>
          </div>
          <h2 style="margin-bottom:8px">Welcome, ${username}! 🎉</h2>
          <p style="color:#8888aa;margin-bottom:20px">Your account is verified. You're ready to compete.</p>
          <a href="${process.env.FRONTEND_URL}/lobby"
             style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none">
            Start Competing →
          </a>
          <p style="color:#55556a;font-size:12px;margin-top:28px">Code. Compete. Win real money.</p>
        </div>
      `,
    });
  } catch (err) {
    logger.error('Welcome email failed', { email, error: err.message });
  }
};

const sendWithdrawalConfirmation = async (email, username, amount, upiId) => {
  try {
    await transporter.sendMail({
      from:    process.env.SMTP_FROM || 'SkillArena <noreply@skillarena.in>',
      to:      email,
      subject: `Withdrawal of ₹${amount} initiated`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0f;color:#f0f0f5;padding:32px;border-radius:12px;border:1px solid #2a2a3a">
          <h2 style="margin-bottom:8px">Withdrawal Initiated</h2>
          <p style="color:#8888aa;margin-bottom:20px">Hi ${username}, your withdrawal request has been received.</p>
          <div style="background:#111118;border:1px solid #2a2a3a;border-radius:10px;padding:20px;margin-bottom:20px">
            <div style="display:flex;justify-content:space-between;margin-bottom:10px">
              <span style="color:#8888aa">Amount</span>
              <span style="color:#10b981;font-weight:700">₹${amount}</span>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span style="color:#8888aa">UPI ID</span>
              <span>${upiId}</span>
            </div>
          </div>
          <p style="color:#55556a;font-size:13px">Withdrawals are processed within 24 hours on business days. If you didn't request this, contact support immediately.</p>
        </div>
      `,
    });
  } catch (err) {
    logger.error('Withdrawal email failed', { email, error: err.message });
  }
};

module.exports = { sendOTP, sendWelcome, sendWithdrawalConfirmation };