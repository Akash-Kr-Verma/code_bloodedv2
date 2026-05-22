const nodemailer = require("nodemailer");

let access_token = undefined
let expires = 0
let sender_id = process.env.MAIL_ADDR

async function updateRefreshToken() {
    let id = process.env.MAIL_ID
    let secret = process.env.MAIL_SEC
    let refresh_token = process.env.MAIL_REFRESH

    if (id == undefined) {
        console.log("❌ GOOGLE_CLIENT_ID")
        return
    }
    if (secret == undefined) {
        console.log("❌ GOOGLE_CLIENT_SEC")
        return
    }
    if (refresh_token == undefined) {
        console.log("❌ GOOGLE_CLIENT_REFRESH")
        return
    }


    let url = "https://oauth2.googleapis.com/token"
    let body = {
        "grant_type": "refresh_token",
        "client_id": id,
        "client_secret": secret,
        "refresh_token": refresh_token,
    }
    let resp = await fetch(url, {
        method: "POST",
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(body)
    })

    let json = await resp.json()

    if (resp.status != 200) {
        console.log("Error getting access token\n", json)
        return
    }

    let time = resp.headers.get("Date")
    if (time == undefined) {
        console.log("Received malformed header from refresh url")
        return
    }

    access_token = json.access_token
    expires = new Date(time).getTime() + json.expires_in * 1000
}

exports.sendMail = async (email, subject, html) => {
    if (sender_id == undefined) {
        console.log("❌ GOOGLE_EMAIL_ID not defined in .env file")
    }

    let tries = 3
    while (tries > 0 && (access_token == undefined || expires < new Date().getTime())) {
        await updateRefreshToken()
        tries--
    }

    if (access_token == undefined || expires < new Date().getTime()) {
        console.log("Failed to get valid access_token")
        return false
    }
    console.log("✅ Access Token")
    let transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
            type: "OAuth2",
            user: sender_id,
            accessToken: access_token
        }
    });
    let mailOptions = {
        from: sender_id,
        to: email,
        subject: subject,
        html: html
    };
    return new Promise((res, _err) => {
        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.log("❌ Error sending email", error)
                res(false)
            } else {
                res(true)
            }
        });
    })

}
