"use strict";

var hashModule;

//settings:
//      masterKey
//          can be obtained: tables - require('mobileservice-config').masterKey
//                           api    - request.service.config.masterKey
//      zumoSettings object(optional)
//          properties: aud, iss, ver
//
//      cryptoIterations
//      cryptoBytes
exports.createHasher = function (settings) {
    return Object.create(hashModule).init(settings);
};

//prefix: 's_' -> static method
hashModule = {
    cryptoIterations: 1000,
    cryptoBytes: 32,
    
    //default
    zumoSettings: {
        aud: 'Custom',
        iss: 'urn:microsoft:windows-azure:zumo',
        ver: 2,
    },
    
    masterKey: null,
    
    cryptoModule: null,

    init: function (settings) {
        var config;
        
        this.cryptoModule = require('crypto');

        settings || (settings = {});
        
        if (!settings.hasOwnProperty('masterKey')) {
            config = require('mobileservice-config');
            settings.masterKey = config.masterKey;
        }
        
        this.masterKey = settings.masterKey;

        settings.cryptoIterations && (this.cryptoIterations = settings.cryptoIterations);
        settings.cryptoBytes && (this.cryptoBytes = settings.cryptoBytes);
        
        if (settings.hasOwnProperty('zumoSettings')) {
            settings.zumoSettings.aud && (this.zumoSettings.aud = settings.zumoSettings.aud);
            settings.zumoSettings.iss && (this.zumoSettings.iss = settings.zumoSettings.iss);
            settings.zumoSettings.ver && (this.zumoSettings.ver = settings.zumoSettings.ver);
        }
        
        return this;
    },

    hash: function (input, salt, callback) {
        this.cryptoModule
            .pbkdf2(
                input, 
                salt, 
                this.cryptoIterations, 
                this.cryptoBytes, 
                function (err, derivedKey) {
                    var hash;
                    
                    if (err) return callback(err);
                    
                    hash = hashModule.s_toBase64(derivedKey);
                    callback(null, hash);
                });
    },

    randomChain: function () {
        var randomChain;

        randomChain = this.cryptoModule.randomBytes(this.cryptoBytes);
        return hashModule.s_toBase64(randomChain);
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
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(new RegExp('=', 'g'), '');
    },
    
    zumoJwt: function (expiryDate, userId) {
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
        
        if (!this.masterKey) throw new Error('masterKey must be defined to use zumoJwt');
        
        key = this.cryptoModule
                  .createHash('sha256')
                  .update(this.masterKey + 'JWTSig')
                  .digest('binary');
                               
        signature = this.cryptoModule
                        .createHmac('sha256', key)
                        .update(input)
                        .digest('base64');

        return this.s_urlFriendly(signature);
    },
};
