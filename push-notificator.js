"use strict";
/**
 *  Módulo para criar notificações push a serem enviadas para o Android e iOS.
 *
 *  dependências:
 *      require('mobileservice-config').appSettings (deve conter os dados de configuração do storage)
 *          appSettings deve conter as keys:
 *              pushNotificationHub <- nome do hub de notificação
 *              pushNotificationEndpoint <- endpoint com a url e a chave compartilhada
 *
 *  exemplo de uso:
        notificator = require({notificator module path}).createPushNotificator({
            pushNotificationHub: {hubpath}
            pushNotificationEndpoint: {endpoint_url}
        });
        
        //enviando para tag especifica ou várias tags
        notificator.addTag(tag);
        notificator.addTag(tag2);
        
        //ou adicionando várias de vez
        notificator.setTags([tag1, tag2]); //array de string
        
        notificator.sendIosNotification(title, message, data, callbackFn);
        notificator.sendAndroidNotification(title, message, data, callbackFn);
        
        //enviando broadcast (todos os aparelhos registrados no hub)
        notificator.activeBroadcast(); //basta deixar as tags vazias, porém assim fica mais legivel e garante o envio
        notificator.sendIosNotification(title, message, null, callbackFn);
        notificator.sendAndroidNotification(title, message, null, callbackFn);
        
 *
 */
var debug = false;
 
exports.createPushNotificator = function (settings) {
    return exports.PushNotificator.create(settings);
};

exports.PushNotificator = {
    azureModule: null,
    notificationHubService: null,
    maxTitleLength: 30,
    maxMessageLength: 140,
    
    tags: null,
    
    create: function () {
        var pushNotificator = Object.create(exports.PushNotificator);
        
        pushNotificator.init.apply(pushNotificator, arguments);
        
        return pushNotificator;
    },
    
    init: function (settings) {
        this.azureModule = require('azure');
        
        this.tags = [];
        
        this.notificationHubService = this.azureModule
                                          .createNotificationHubService(
                                                settings.pushNotificationHub,
                                                settings.pushNotificationEndpoint
                                           );
                                           
        debug && console.log('notification settings', settings);
    },
    
    _truncateText: function (text, max, suffix) {
        if (text.length <= max) return text;
        
        suffix || (suffix = '');
        return text.substr(0, max - suffix.length) + suffix;
    },
    
    addTag: function (tag) {
        if (this.tags.indexOf(tag) === -1) {
            this.tags.push(tag);
        }
        
        return this;
    },
    
    setTags: function (tags) {
        this.tags = tags;
        
        return this;
    },
    
    clearTags: function () {
        this.tags = [];
        
        return this;
    },
    
    sendIosNotification: function (title, message, data, callback) {
        var alertMessage,
            truncatedSuffix = '...',
            totalTags = this.tags.length,
            tagsSent = 0,
            results = [];
        
        title = this._truncateText(title.trim(), this.maxTitleLength, truncatedSuffix);
        message = this._truncateText(message.trim(), this.maxMessageLength, truncatedSuffix);
        
        alertMessage = (title && (title + ' - ')) + message;
        
        data = (data && Object.create(data)) || {};
        
        data.alert = alertMessage;
    
        if (!totalTags) {
            this._sendIosNotification(null, data, callback);
            return;
        }
        
        this.tags.forEach(function (tag) {
            this._sendIosNotification(tag, data, function (error, result) {
                if (!callback) return;

                tagsSent += 1;
                results.push(error);
                
                if (tagsSent === totalTags) {
                    callback.call(this, results);
                }
            });
        }.bind(this));
    },
    
    _sendIosNotification: function (tag, data, callback) {
        this.notificationHubService.apns.send(tag, {aps: data}, callback);
    },
    
    sendAndroidNotification: function (title, message, data, callback) {
        var totalTags = this.tags.length,
            tagsSent = 0,
            results = [];
        
        data = (data && Object.create(data)) || {};
        data.title = title;
        data.message = message;
        
        if (!totalTags) {
            this._sendAndroidNotification(null, data, callback);
            return;
        }
        
        this.tags.forEach(function (tag) {
            this._sendAndroidNotification(tag, data, function (error, result) {
                if (!callback) return;

                tagsSent += 1;
                results.push(error);
                
                if (tagsSent === totalTags) {
                    callback.call(this, results);
                }
            }.bind(this));
        }.bind(this));
    },
    
    _sendAndroidNotification: function (tag, data, callback) {
        this.notificationHubService.gcm.send(tag, {data: data}, callback);
    },
    
    //envia para todas as plataformas a mesma mensagem (por enquanto, android e ios)
    sendNotification: function (title, message, data, callback) {
        var platformsSent = 0,
            totalPlatforms = 2,
            resultByPlatform = {},
            innerCallback;

        innerCallback = function (platform, result) {
            if (!callback) return;
            
            platformsSent += 1;
            
            resultByPlatform[platform] = result;
            
            if (platformsSent === totalPlatforms) {
                callback.call(this, resultByPlatform);
            }
        };
        
        this.sendAndroidNotification(title, message, data, innerCallback.bind(this, 'android'));
        this.sendIosNotification(title, message, data, innerCallback.bind(this, 'ios'));
    },
};