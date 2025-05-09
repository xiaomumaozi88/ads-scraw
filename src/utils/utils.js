// src/utils/dateUtils.js
import token from './token.js';
import config from '../config/api.js'

export function curDate() {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}


export async function callService(URI, method, body,opt={}) {
    const res = await fetch(
        new URL(URI,config.api_host),
        {
            headers:{
                ['Content-Type']:'application/json'
            },
            method,
            body,
            ...opt

        }
    );
    const { success, code, message, data }=await res.json();
    if (!success) throw Object.assign(new Error(message), { code });

    return data;
}


/**
 * @param {File} file
 * @param {Boolean} grant  true公有地址 false私有地址
 * @return {String} File URL
 */
export async function upload(file, grant = true) {
    try {
        await token();
    // 获取文件上传的地址（阿里云）
    const times=new Date().getTime();
    const id='grorder'+times+file.size
    const oss = await callService('storage/form?access_token='+global.accessToken, 'POST', JSON.stringify(
        {
            fileName: times,
            maxSize: file.size,
            id,
            noExpire: true,
            grant,
            fileId: '/grorder/'+times+ file.size,
            outPublic: true
        }
    ));
    // 获取文件上传的地址（亚马逊）
    const aws = grant
        ? await callService('storage/s3/form?access_token='+global.accessToken, 'POST', JSON.stringify({
            fileName: times,
            // maxSize: file.size,
            id,
            grant: grant,
            fileId: oss.id,
            outPublic: true
        }))
        : {};

        let formData = new FormData();
        for (let key in oss.form) {
            formData.append(key, oss.form[key]);
        }
        formData.append('success_action_status', '200');
        formData.append('file', file);
        const res = await Promise.all(
            [
                fetch(oss.url, {
                    method: 'POST',
                    body: formData
                })
            ].concat(
                grant
                    ?  fetch(aws.url, {
                          method: 'PUT',
                          body: file,
                          headers: {
                            'Content-Type': file.type
                        },
                      })
                    :
                     []
            )
        );
        if (res.every(item => item.status === 200)) {
            return await callService(
                grant
                    ? `storage/s3/file/${oss.id}/link?grant=${grant}&outPublic=true&access_token=${global.accessToken}`
                    : `storage/file/link?id=${oss.id}&grant=${grant}&noExpire=true&outPublic=true&access_token=${global.accessToken}`
            );
        } else{
         logger.error('utils upload status error')
        }
    } catch (e) {
        logger.error('utils upload error =>', e.message)
    }
}
