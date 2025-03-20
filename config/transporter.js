// import nodemailer from 'nodemailer';
// import dotenv from 'dotenv';
// dotenv.config();

// const transporter = nodemailer.createTransport({
//     host: process.env.SMTP_HOST,
//     port: process.env.SMTP_PORT,
//     secure: false, // true for port 465 
//     auth: {
//         user: process.env.SMTP_USERNAME,  
//         pass: process.env.SMTP_PASSWORD   
//     }
// });


// // Verify transporter configuration
// transporter.verify(function(error, success) {
//     if (error) {
//         console.log("Transporter verification error:", error);
//     } else {
//         console.log("Email server is ready to send messages");
//     }
// });

// export default transporter;
