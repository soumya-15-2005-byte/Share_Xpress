const nodemailer = require("nodemailer");

module.exports = async ({ from, to, subject, text, html}) => {
    let transporter;
    
    if (process.env.MAIL_USER && process.env.MAIL_PASSWORD) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.ethereal.email',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASSWORD,
            },
        });
    } else {
        console.log("⚠️ SMTP credentials not configured in .env. Auto-generating Ethereal test account...");
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
    }

    // send mail with defined transport object
    let info = await transporter.sendMail({
        from: `inShare <${from}>`, // sender address
        to: to, // list of receivers
        subject: subject, // Subject line
        text: text, // plain text body
        html: html, // html body
    });

    if (!process.env.MAIL_USER) {
        console.log("-----------------------------------------");
        console.log("✉️ Ethereal Email Preview URL:");
        console.log(nodemailer.getTestMessageUrl(info));
        console.log("-----------------------------------------");
    }

    return info;
}