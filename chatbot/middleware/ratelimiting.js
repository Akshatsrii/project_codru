
 function rateLimit(req, res, next) {
    const ip = req.ip;
    const now = Date.now();
    if(!global.rateLimits) {
        global.rateLimits = {};
    }
    if(!global.rateLimits[ip]) {
        global.rateLimits[ip] = {
            count: 1,
            lastRequest: now
        };
    } else {
        const diff = now - global.rateLimits[ip].lastRequest;
        if(diff < 1000) {
            global.rateLimits[ip].count++;
            if(global.rateLimits[ip].count > 30) {
                res.status(429).send("Too many requests");
                return;
            }
        } else {
            global.rateLimits[ip].count = 1;
        }
        global.rateLimits[ip].lastRequest = now;
    }
    next();
    }

    export { rateLimit };