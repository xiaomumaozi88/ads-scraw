
const config_dev={
    token:{
        appId:'discord-robot-app',
        appSecret:'2657IMkXMLbSQL2DBnN4lk9SB3uw',
    },
    api_host:'http://172.20.90.123:10030/',
}
const config_prod={
    token:{
        appId:'whatsApp-aics',
        appSecret:'piTbP1Glq6flHoIeUcud8JNBGr', 
    },
    api_host:`https://ms-open-gateway-aws.internal.tap4fun.com/`,
}


export default process.env.RUNTIME_ENV==='aws-prod' ? config_prod :  config_dev