"use strict";

var debug = false,
    customAuthenticator;
    
exports.createAuthenticator = function (settings) {
    return Object.create(customAuthenticator).init(settings);
};
    
customAuthenticator = {
    cryptoIterations: 100,
    cryptoBytes: 32,
    
    zumoSettings: {
        aud: 'Custom',
        iss: 'urn:microsoft:windows-azure:zumo',
        ver: 2,
    },
    
    expirySecondsSpan: 20 * 60, //20 minutes
    
    masterKey: null,
    
    cryptoModule: null,
    
    //settings:
    //      masterKey
    //          can be obtained: tables - require('mobileservice-config').masterKey
    //                           api    - request.service.config.masterKey
    //      zumoSettings object(optional)
    //          properties: aud, iss, ver
    //
    //      expirySecondsSpan (options)
    //          how many seconds the user token will valid
    init: function (settings) {
        this.cryptoModule = require('crypto');

        settings || (settings = {});
        
        this.masterKey = settings.masterKey;

        if (settings.hasOwnProperty('zumoSettings')) {
            settings.zumoSettings.aud && (this.zumoSettings.aud = settings.zumoSettings.aud);
            settings.zumoSettings.iss && (this.zumoSettings.iss = settings.zumoSettings.iss);
            settings.zumoSettings.ver && (this.zumoSettings.ver = settings.zumoSettings.ver);
        }
        
        settings.expirySecondsSpan && (this.expirySecondsSpan = settings.expirySecondsSpan);
        
        return this;
    },
    
    //authInput = {password: <plain text password>, salt: <salt string>}
    //opts = {success: fn(){...}, error: fn(){...}}
    validatePassword: function (authInput, hashedPassword, opts) {
        opts || (opts = {});
        
        this._hash(
            authInput.password, 
            authInput.salt,
            function (err, hashedInput) {
                if (err) {
                    console.error('severity error hashing password', err);
                    opts.error && opts.error(err);
                    return;
                }
                
                if (customAuthenticator.s_slowEquals(hashedInput, hashedPassword)) {
                    opts.success && opts.success();
                } else {
                    opts.error && opts.error();
                }
            }
        );
    },
    
    //generateAuth(password, [salt,] callback);
    //password <plain text password>
    //callback params: {password: ..., salt: ...}
    //optionally a salt can be passed to avoid the generation of a random one by the function
    generateAuth: function (password, salt, callback) {
        if (typeof salt === 'function') {
            callback = salt;
            salt = this._randomSalt();
        }
        
        this._hash(password, salt, function (err, hashedPassword) {
            if (err) return callback({error: err});
            
            callback({
                password: hashedPassword,
                salt: salt,
            });
        });
    },
    
    authenticate: function (userId) {
        var expiryDate = new Date();
        
        expiryDate.setUTCSeconds(expiryDate.getUTCDate() + this.expirySecondsSpan);
        
        return {
            id: userId,
            token: this._zumoJwt(expiryDate.valueOf(), userId),
            expires: expiryDate.valueOf()
        };
    },
    
    _hash: function (password, salt, callback) {
        this.cryptoModule
            .pbkdf2(
                password, 
                salt, 
                this.cryptoIterations, 
                this.cryptoBytes, 
                function (err, derivedKey){
                    var hash;
                    
                    if (err) return callback(err);
                    
                    hash = customAuthenticator.s_toBase64(derivedKey);
                    callback(null, hash);
                });
    },
    
    _randomSalt: function () {
        var randomChain;
        
        randomChain = this.cryptoModule.randomBytes(this.cryptoBytes);
        return customAuthenticator.s_toBase64(randomChain);
    },
    
    s_toBase64: function (input) {
        return new Buffer(input, 'utf8').toString('base64');
    },
    
    s_slowEquals: function (a, b) {
        var i, diff;

        diff = a.length ^ b.length;
        for (i = 0; i < a.length && i < b.length; i += 1) {
            diff |= (a[i] ^ b[i]);
        }
        return diff === 0;
    },
    
    s_urlFriendly: function (base64) {
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(new RegExp("=", "g"), '');
    },
    
    _zumoJwt: function (expiryDate, userId) {
        var parts = [], conf, data;
        
        conf = {alg: 'HS256', typ: 'JWT', kid: '0'};
        data = {
            exp: expiryDate.valueOf() / 1000,
            iss: this.zumoSettings.iss,
            ver: this.zumoSettings.ver,
            aud: this.zumoSettings.aud,
            uid: userId
        };
        
        parts[0] = this.s_urlFriendly(this.s_toBase64(JSON.stringify(conf)));
        parts[1] = this.s_urlFriendly(this.s_toBase64(JSON.stringify(data)));
        parts[2] = this._zumoSignature(parts.join('.'));
        
        return parts.join('.');
    },
    
    _zumoSignature: function (input) {
        var key, signature;
        
        key = this.cryptoModule
                  .createHash('sha256')
                  .update(this.masterKey + "JWTSig")
                  .digest('binary');
                               
        signature = this.cryptoModule
                        .createHmac('sha256', key)
                        .update(input)
                        .digest('base64');

        return this.s_urlFriendly(signature);
    },
};

