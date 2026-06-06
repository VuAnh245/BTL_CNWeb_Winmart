const crypto = require('crypto');
const moment = require('moment');
const axios = require('axios');
const db = require('../config/db');

// --- VNPAY ---
exports.createVNPayUrl = (req, amount, orderInfo, returnUrl) => {
    let tmnCode = (process.env.VNP_TMN_CODE || '').trim();
    let secretKey = (process.env.VNP_HASH_SECRET || '').trim();
    let vnpUrl = (process.env.VNP_URL || '').trim();
    let currCode = 'VND';

    let date = new Date();
    let createDate = moment(date).format('YYYYMMDDHHmmss');
    
    let ipAddr = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    // Force IPv4 for local environments to prevent VNPay signature issues with IPv6 (::1)
    if (ipAddr === '::1' || ipAddr.includes('::ffff:')) {
        ipAddr = '127.0.0.1';
    }

    let vnp_Params = {};
    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = tmnCode;
    vnp_Params['vnp_Locale'] = 'vn';
    vnp_Params['vnp_CurrCode'] = currCode;
    vnp_Params['vnp_TxnRef'] = orderInfo;
    vnp_Params['vnp_OrderInfo'] = 'Thanh toan don hang ' + orderInfo;
    vnp_Params['vnp_OrderType'] = 'other';
    vnp_Params['vnp_Amount'] = amount * 100;
    vnp_Params['vnp_ReturnUrl'] = returnUrl || process.env.VNP_RETURN_URL;
    vnp_Params['vnp_IpAddr'] = ipAddr;
    vnp_Params['vnp_CreateDate'] = createDate;

    vnp_Params = sortObject(vnp_Params);

    let querystring = require('qs');
    let signData = querystring.stringify(vnp_Params, { encode: false });
    
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex"); 
    
    console.log("=== VNPAY DEBUG ===");
    console.log("Secret Key:", secretKey);
    console.log("Sign Data:", signData);
    console.log("Hash:", signed);
    console.log("===================");
    
    vnp_Params['vnp_SecureHash'] = signed;
    vnpUrl += '?' + querystring.stringify(vnp_Params, { encode: false });

    return vnpUrl;
};

exports.verifyVNPayReturn = (vnp_Params) => {
    let secureHash = vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    
    let secretKey = (process.env.VNP_HASH_SECRET || '').trim();
    let querystring = require('qs');
    let signData = querystring.stringify(vnp_Params, { encode: false });
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

    if(secureHash === signed){
        return { isValid: true, isSuccess: vnp_Params['vnp_ResponseCode'] === '00' };
    } else{
        return { isValid: false, isSuccess: false };
    }
};

// --- MOMO ---
exports.createMoMoUrl = async (amount, orderInfo, returnUrl, ipnUrl) => {
    var partnerCode = process.env.MOMO_PARTNER_CODE;
    var accessKey = process.env.MOMO_ACCESS_KEY;
    var secretkey = process.env.MOMO_SECRET_KEY;
    var requestId = partnerCode + new Date().getTime();
    var orderId = orderInfo + "_" + new Date().getTime(); // MoMo requires unique orderId per request
    var orderInfoDesc = "Thanh toán đơn hàng " + orderInfo;
    var redirectUrl = returnUrl || process.env.MOMO_REDIRECT_URL;
    var ipnUrlFinal = ipnUrl || process.env.MOMO_IPN_URL;
    var requestType = "captureWallet";
    var extraData = orderInfo; // Pass original orderCode here

    var rawSignature = "accessKey=" + accessKey + "&amount=" + amount + "&extraData=" + extraData + "&ipnUrl=" + ipnUrlFinal + "&orderId=" + orderId + "&orderInfo=" + orderInfoDesc + "&partnerCode=" + partnerCode + "&redirectUrl=" + redirectUrl + "&requestId=" + requestId + "&requestType=" + requestType;
    var signature = crypto.createHmac('sha256', secretkey).update(rawSignature).digest('hex');

    const requestBody = JSON.stringify({
        partnerCode: partnerCode,
        accessKey: accessKey,
        requestId: requestId,
        amount: amount,
        orderId: orderId,
        orderInfo: orderInfoDesc,
        redirectUrl: redirectUrl,
        ipnUrl: ipnUrlFinal,
        extraData: extraData,
        requestType: requestType,
        signature: signature,
        lang: 'vi'
    });

    try {
        const response = await axios.post(process.env.MOMO_API_URL, requestBody, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return response.data.payUrl;
    } catch (error) {
        console.error("MoMo Error:", error.response ? error.response.data : error.message);
        throw new Error("Lỗi kết nối MoMo");
    }
};

exports.verifyMoMoReturn = (query) => {
    var partnerCode = process.env.MOMO_PARTNER_CODE;
    var accessKey = process.env.MOMO_ACCESS_KEY;
    var secretkey = process.env.MOMO_SECRET_KEY;
    
    // MoMo callback returns orderId, amount, orderInfo, message, resultCode, payType, extraData, signature etc.
    var reqSignature = query.signature;
    
    var rawSignature = "accessKey=" + accessKey + "&amount=" + query.amount + "&extraData=" + query.extraData + "&message=" + query.message + "&orderId=" + query.orderId + "&orderInfo=" + query.orderInfo + "&orderType=" + query.orderType + "&partnerCode=" + partnerCode + "&payType=" + query.payType + "&requestId=" + query.requestId + "&responseTime=" + query.responseTime + "&resultCode=" + query.resultCode + "&transId=" + query.transId;
    var signature = crypto.createHmac('sha256', secretkey).update(rawSignature).digest('hex');
    
    if (signature === reqSignature) {
        return { isValid: true, isSuccess: query.resultCode == 0 };
    }
    return { isValid: false, isSuccess: false };
};

// Utilities
function sortObject(obj) {
	let sorted = {};
	let str = [];
	let key;
	for (key in obj){
		if (obj.hasOwnProperty(key)) {
		str.push(encodeURIComponent(key));
		}
	}
	str.sort();
    for (key = 0; key < str.length; key++) {
        sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
    }
    return sorted;
}

// --- REFUND API (VNPay & MoMo) ---
exports.refundVNPay = async (orderId, amount, transDate, user) => {
    // Note: VNPay refund API requires vnp_RequestId, vnp_Command=refund, etc.
    let tmnCode = (process.env.VNP_TMN_CODE || '').trim();
    let secretKey = (process.env.VNP_HASH_SECRET || '').trim();
    let vnpApiUrl = process.env.VNP_API_URL || 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';
    
    let date = new Date();
    let createDate = moment(date).format('YYYYMMDDHHmmss');
    let requestId = moment(date).format('HHmmss') + Math.floor(Math.random() * 10000);
    
    let data = {
        vnp_RequestId: requestId,
        vnp_Version: '2.1.0',
        vnp_Command: 'refund',
        vnp_TmnCode: tmnCode,
        vnp_TransactionType: '02', // 02 for full refund
        vnp_TxnRef: orderId,
        vnp_Amount: amount * 100,
        vnp_OrderInfo: 'Hoan tien don hang ' + orderId,
        vnp_TransactionNo: '0', // If not available
        vnp_TransactionDate: transDate, // Format YYYYMMDDHHmmss
        vnp_CreateBy: user || 'Admin',
        vnp_CreateDate: createDate,
        vnp_IpAddr: '127.0.0.1'
    };
    
    let signData = data.vnp_RequestId + "|" + data.vnp_Version + "|" + data.vnp_Command + "|" + data.vnp_TmnCode + "|" + data.vnp_TransactionType + "|" + data.vnp_TxnRef + "|" + data.vnp_Amount + "|" + data.vnp_TransactionNo + "|" + data.vnp_TransactionDate + "|" + data.vnp_CreateBy + "|" + data.vnp_CreateDate + "|" + data.vnp_IpAddr + "|" + data.vnp_OrderInfo;
    let hmac = crypto.createHmac("sha512", secretKey);
    data.vnp_SecureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
    
    try {
        const response = await axios.post(vnpApiUrl, data);
        return { success: response.data.vnp_ResponseCode === '00', message: response.data.vnp_Message, data: response.data };
    } catch (err) {
        return { success: false, message: err.message };
    }
};

exports.refundMoMo = async (orderId, amount, transId) => {
    let partnerCode = process.env.MOMO_PARTNER_CODE;
    let accessKey = process.env.MOMO_ACCESS_KEY;
    let secretkey = process.env.MOMO_SECRET_KEY;
    let refundApiUrl = process.env.MOMO_REFUND_URL || 'https://test-payment.momo.vn/v2/gateway/api/refund';
    
    let requestId = partnerCode + new Date().getTime();
    let orderIdReq = "REFUND_" + orderId + "_" + new Date().getTime();
    let description = "Hoan tien don hang " + orderId;
    
    let rawSignature = "accessKey=" + accessKey + "&amount=" + amount + "&description=" + description + "&orderId=" + orderIdReq + "&partnerCode=" + partnerCode + "&requestId=" + requestId + "&transId=" + transId;
    let signature = crypto.createHmac('sha256', secretkey).update(rawSignature).digest('hex');
    
    let requestBody = {
        partnerCode: partnerCode,
        requestId: requestId,
        orderId: orderIdReq,
        amount: amount,
        transId: transId,
        lang: 'vi',
        description: description,
        signature: signature
    };
    
    try {
        const response = await axios.post(refundApiUrl, requestBody);
        return { success: response.data.resultCode === 0, message: response.data.message, data: response.data };
    } catch (err) {
        return { success: false, message: err.message };
    }
};
