 import config from '../config/api.js';

 
export default async () => {
    // 判断是否过期，没过期就不走下面逻辑，使用原来的accessToken
    // 提前10分钟
    const prevExpiredTime = Date.now() + 10 * 60 * 1000;

    if (global.accessToken && global.expireAt > prevExpiredTime)  {
        return global.accessToken;
    };
    logger.info('request token')
    return new Promise(async (resolve, reject) => {
        try {
            const res = await fetch(`${config.api_host}auth/accesstoken`, {
                method:'POST',
                headers: {
                    'Content-type': 'application/json',
                },
                body: JSON.stringify({
                    appId:config.token.appId,
                    appSecret:config.token.appSecret,
                })
            });

            const data = await res.json();
            if(data.success){   
                 const { 
                     accessToken, expireIn ,
                } = data.data;
                  // 这里通过global对象共享accessToken和expireAt
                global.accessToken = accessToken;
                global.expireAt = Date.now() + expireIn * 1000;
                resolve(accessToken)
            }else{
                logger.error('accessToken get fail =>',JSON.stringify(data))
                resolve(false)
            }
        } catch (e) {
            logger.error('accessToken get error =>',e.message)
            resolve(false)
        }
    })

    
};
