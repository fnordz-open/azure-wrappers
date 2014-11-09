"use strict";
/**
    depende do executor sql do azure 'mssql'.
    
    -> queryInsert:
        scheme, table, [item]
        >>>>>> OBSERVAÇÃO (antes de usar, leia abaixo) <<<<<
        - OBS.: a query insert deve ser usada apenas quando o item a ser inserido não possuir um campo
                id. Caso contrário, o ideal é utilizar o table.insert(item, opts);
        - se uma das propriedades do item a ser inserido começar com '@', então o valor da propriedade
          pode ser um trecho sql. por exemplo: 
            item = {text: 'lorem ipsum', '@created_at': 'GETDATE()'};
            geraria o sql: 
                INSERT INTO scheme.table (text, created_at) VALUES (?, GETDATE());
            
            e os params: ['lorem ipsum']
          
        exemplo de uso:
            sql = QueryBuilder.createQueryInsert({scheme: 'scheme', table: 'table'});
            sql.setItem(item);
            sql.exec({mssql: mssql, success: function () {...});

            
            
    -> queryDelete:
        scheme, table, whereParams
        whereParams: 
            um objeto que será usado para fazer a query e identificar quais elementos
            devem ser removidos. Todas as propriedades do objeto devem ser satisfeitas na query (AND).
        - uma propriedade pode ser um objeto composto de {op: (...), value: (...)}, é possível
            passar um operador ao invés do default (=).
        - o valor de uma propriedade
        - se uma das propriedades do item a ser inserido começar com '@', então o valor da propriedade
          pode ser um trecho sql. por exemplo: 
            where = {
                status: 1,
                description: {op: 'LIKE', value: 'lorem%'},
                '@created_at': {op: '<', value: 'GETDATE()'}
            };
            geraria o sql: 
                DELETE FROM scheme.table 
                WHERE status = ? 
                  AND description LIKE ? 
                  AND created_at < GETDATE()
                  
            e os params: [1, 'lorem%']
          
        exemplo de uso:
            sql = QueryBuilder.createQueryDelete({scheme: 'scheme', table: 'table'});
            sql.where(whereClauses);
            sql.exec({mssql: mssql, success: function () {...});

     
    -> queryProcedure:
        scheme, procedure, [params]
        
        - monta um sql para executar uma procedure
        - se params for um array, monta a query com ? nos parâmetros resultando em algo como:
            exec scheme.procedure ?, ?, ?, ?
            
        - se params for objeto, a key do objeto se torna um parâmetro nomeado da procedure:
            exec scheme.procedure @param1=?, @param2=?
            possibilitando que os outros parâmetros da procedure recebam o valor default da procedure
        
        exemplo de uso:
            sql = QueryBuilder.createQueryProcedure({scheme: 'scheme', procedure: 'procedure'});
            sql.setParams(params);
            sql.exec({mssql: mssql, success: function () {...});
    
    
    
    opts keys para o método exec:
        mssql    [required]
        response [required for default execution]
        success
        additionalData (acrescenta ou sobrescreve dados à resposta padrão) [only for default execution]
        formatData (modifica livremente os dados da resposta padrão) [only for default execution]
        error
 */

var debug = true,
    
    baseQuery,
    queryInsert,
    queryDelete,
    queryProcedure;

baseQuery = {
    _defaultSuccess: function (opts, results) {
        var key, jsonResult;

        jsonResult = {results: results};
        
        if (results && (typeof results.length === 'number')) {
            jsonResult.count = results.length;
        }
        
        if (opts.additionalData) {
            for (key in opts.additionalData) {
                if (!opts.additionalData.hasOwnProperty(key)) continue;
                
                jsonResult[key] = opts.additionalData[key];
            }
        }
        
        if (opts.formatData) {
            jsonResult = opts.formatData(jsonResult, results);
        }
        
        if (typeof opts.response === 'function') {
            //request.respond
            opts.response(200 /*Ok*/, jsonResult);
        } else {
            opts.response.json(jsonResult);
        }
    },
    
    setParams: function (params) {
        this._buildSql(params);
        
        return this;
    },
    
    //opts keys:
    //  mssql    [required if not setted]
    //  response [required for default execution]
    //  success
    //  additionalData [only for default execution]
    //  error
    exec: function (opts) {
        var options, mssql;

        mssql = opts.mssql || this.mssql;
        
        if (!mssql) throw new Error('exec(): needs reference to mssql');
        if (!opts.response && !opts.success) throw new Error('exec(): needs "response" or a callback "success"');
        if (opts.success && opts.additionalData) console.warning('exec(): additionalData can\'t be used with a callback');

        //defining the callbacks
        options = {};
        options.success = opts.success || this._defaultSuccess.bind(null, opts);
        
        if (opts.error) options.error = opts.error;
        
        mssql.query(this.sql, this.params, options);
    }
};
    
queryInsert = {
    scheme: null,
    table: null,
    
    sql: null,
    item: null,
    params: null,
    
    create: function (schemeName, tableName, mssql, item) {
        var query = Object.create(queryInsert);
        
        query.scheme = schemeName;
        query.table = tableName;
        query.mssql = mssql;
        if (item) query._buildSql(item);
        
        return query;
    },
    
    _buildSql: function (params) {
        var sqlParams = this._buildColumnsAndValues(params);
        
        this.item = params;
        
        this.sql = [
            'INSERT INTO',
            (((this.scheme && (this.scheme) + '.') || '') + this.table),
            '(', 
                sqlParams.columns,
            ')VALUES(',
                sqlParams.valuesPlaceholders,
            ')'
        ].join(' ');
        
        return this.sql;
    },
    
    _buildColumnsAndValues: function (params) {
        var paramList = [],
            columns = [],
            placeholders = [],
            key, paramValue;
            
        this.params = paramList;
        
        if (!params) return '';
        
        for (key in params) {
            paramValue = params[key];
            
            //== para verificar null ou undefined
            //filtra também funções
            if ((paramValue == null) || (typeof paramValue === 'function')) continue;
            
            //escape para por SQL como valor, ao invés de um placeholder
            if (key[0] === '@') {
                columns.push(key.substring(1));
                placeholders.push(paramValue);
                continue;
            }
            
            columns.push(key);
            placeholders.push('?');
            paramList.push(paramValue);
        }
        
        return {
            columns: columns.join(','),
            valuesPlaceholders: placeholders.join(',')
        };
    },
    
    setItem: baseQuery.setParams,
    exec: baseQuery.exec,
    _defaultSuccess: baseQuery._defaultSuccess,
};
    
queryDelete = {
    scheme: null,
    table: null,
    
    sql: null,
    params: null,
    
    create: function (schemeName, tableName, mssql, params) {
        var query = Object.create(queryDelete);
        
        query.scheme = schemeName;
        query.table = tableName;
        query.mssql = mssql;
        query._buildSql(params);
        
        return query;
    },
    
    _buildSql: function (params) {
        var paramsPlaceholders = this._buildWherePlaceholders(params);
        
        this.sql = [
            'DELETE FROM',
            (((this.scheme && (this.scheme) + '.') || '') + this.table)
        ].join(' ');
        
        if (paramsPlaceholders) {
            this.sql = [
                this.sql,
                'WHERE', 
                paramsPlaceholders
            ].join(' ');
        }
        
        return this.sql;
    },
    
    _buildWherePlaceholders: function (params) {
        var paramList = [],
            sqlParams = [],
            op, key, paramValue, paramType;
            
        this.params = paramList;
        
        if (!params) return '';
        
        for (key in params) {
            paramValue = params[key];
            paramType = typeof paramValue;
            
            //== para verificar null ou undefined
            //filtra também funções
            if ((paramValue == null) || (paramType === 'function')) continue;
            
            if (paramType === 'object') {
                op = paramValue.op;
                paramValue = paramValue.value;
            } else {
                op = '=';
            }
            
            //SQL inline
            if (key[0] === '@') {
                sqlParams.push(key.substring(1) + ' ' + op + ' ' + paramValue);
                continue;
            }
            
            
            sqlParams.push(key + ' ' + op + ' ' + '?');
            paramList.push(paramValue);
        }
        
        return sqlParams.join(' AND ');
    },
    
    where: baseQuery.setParams,
    exec: baseQuery.exec,
    _defaultSuccess: baseQuery._defaultSuccess,
};

queryProcedure = {
    scheme: null,
    procedure: null,
    
    sql: null,
    params: null,
    
    create: function (schemeName, procedureName, mssql, params) {
        var query = Object.create(queryProcedure);

        query.scheme = schemeName;
        query.procedure = procedureName;
        query.mssql = mssql;
        query._buildSql(params);
        
        return query;
    },
    
    _buildSql: function (params) {
        var paramsPlaceholder = '';
        
        if (params) {
            paramsPlaceholder = (Array.isArray(params)) ?
                this._buildParamsPlaceholders(params)
                : this._buildNamedParamsPlaceholders(params);
        }   
        
        this.sql = ['exec', 
                    ((this.scheme && (this.scheme) + '.') || '') + this.procedure, 
                    paramsPlaceholder].join(' ');            
        
        return this.sql;
    },
    
    _buildParamsPlaceholders: function (params) {
        this.params = params.concat();
    
        if (!params.length) return '';
        
        return (new Array(params.length - 1)).concat('?').join('?,');
    },
    
    _buildNamedParamsPlaceholders: function (params) {
        var paramList = [],
            sqlParams = [],
            key, paramValue;
            
        this.params = paramList;
        
        if (!params) return '';
        
        for (key in params) {
            paramValue = params[key];
            
            //== para verificar null ou undefined
            //filtra também funções
            if ((paramValue == null) || (typeof paramValue === 'function')) continue;
            
            //escape para por SQL como valor, ao invés de um placeholder
            if (key[0] === '@') {
                sqlParams.push(key + '=' + paramValue);
                continue;
            }
            
            sqlParams.push('@' + key + '=?');
            paramList.push(paramValue);
        }
        
        return sqlParams.join(',');
    },
    
    setParams: baseQuery.setParams,
    exec: baseQuery.exec,
    _defaultSuccess: baseQuery._defaultSuccess,
};

exports.QueryBuilder = {
    createQueryInsert: function (opts) {
        opts || (opts = {});

        return queryInsert.create(opts.scheme, opts.table, opts.mssql, opts.item);
    },
    
    createQueryDelete: function (opts) {
        opts || (opts = {});

        return queryDelete.create(opts.scheme, opts.table, opts.mssql, opts.where);
    },
    
    createQueryProcedure: function (opts) {
        opts || (opts = {});

        return queryProcedure.create(opts.scheme, opts.procedure, opts.mssql, opts.params);
    }
};
