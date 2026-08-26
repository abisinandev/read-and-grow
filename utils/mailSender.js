import nodemailer from "nodemailer"
import { CONFIG } from "./constants/envConfig.js"

const mailSender = async (email, title, body) => {
    try{
        let transporter = nodemailer.createTransport({
            host:'smtp.gmail.com',
            port:587,
            secure:false, 
            auth:{
                user:CONFIG.MAIL_USER,
                pass:CONFIG.MAIL_PASS
            }
        })

        let info = await transporter.sendMail({
            from : CONFIG.MAIL_USER,
            to : email,
            subject : title,
            html : body
        })

        console.log(`Email info : ${info}`)
    }catch(error){
        console.log(`Error mailSender ${error.message}`)
    }
}
 
export default mailSender