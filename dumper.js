"use strict";

/**
 *  Outputa e loga o objeto passado com detalhes sobre o tipo e valores internos.
 *  (baseado no var_dump do php)
 *      function varDump(obj, message, options) {...}
 *
 *  obj: coisa a ser dumpada
 *  message: funciona para identificar o varDump e vai aparecer antes de qualquer output
 *  options: configura o dump com as seguintes opções possíveis
 *           paddingChar -> diz qual o char usado para identação (default: ' ')
 *           paddingSize -> quantos chars devem ser usados por nível de identação (default: 4)
 *           maxDepthLevel -> profundidade máxima para explorar referências em um objeto
 *                             (se 0, ou não setado, não limita a profundidade)
 *           noString -> encurta a impressão da string evitando imprimir o valor interno
 *           noRegExp -> encurta a impressão da RegExp evitando imprimir o valor interno
 *           noDate -> encurta a impressão de Date evitando imprimir o valor interno
 *           noFn -> encurta a impressão de uma função evitando imprimir a implementação
 *           onlyHeaderFn -> imprime apenas o cabeçalho da função, omitindo o corpo
 *           splitOnTruncate -> quando o log é muito grande e pode ser truncado pelo azure,
 *                              faz com que o resultado seja divido em vário logs
 */
exports.varDump = (function () {
    function _repeat_char(len, pad_char) {
        var str = '', i;
        for (i = 0; i < len; i++) {
            str += pad_char;
        }
        return str;
    }
    
    function _getInnerVal(val, thick_pad, options) {
        var ret = '', funcLines, i, type, fll;
        
        type = typeof val;
        
        if (val === null) {
            ret = 'null';
        } else if (type === 'boolean') {
            ret = 'boolean(' + val + ')';
        } else if (type === 'string') {
            if (options.noString) {
                ret = 'str(...)';
            } else {
                ret = 'string(' + val.length + ') "' + val + '"';
            }
        } else if (type === 'number') {
            ret = 'number(' + val + ')';
        } else if (type === 'undefined') {
            ret = 'undefined';
        } else if (type === 'function'){
            if (options.noFn) {
                ret = 'function () {...}';
            } else if (options.onlyHeaderFn) {
                ret = val.toString().split('{')[0] + '{...}';
            } else {
                funcLines = val.toString().split('\n');
                ret = '';
                for (i = 0, fll = funcLines.length; i < fll; i++) {
                    ret += (i !== 0 ? '\n' + thick_pad : '') + funcLines[i];
                }
            }
        } else if (val instanceof Date) {
            if (options.noDate) {
                ret = 'Date(...)';
            } else {
                ret = 'Date(' + val + ')';
            }
        } else if (val instanceof RegExp) {
            if (options.noRegExp) {
                ret = 'RegExp(...)';
            } else {
                ret = 'RegExp(' + val + ')';
            }
        } 
        return ret;
    }
    
    function _formatArray(obj, cur_depth, options, alreadyRecursed) {
        var someProp = '',
            base_pad,
            thick_pad,
            str = '',
            val = '', 
            lgth = 0, key, objVal, isArray, 
            
            //configurable defaults
            maxDepthLevel = options.maxDepthLevel,
            pad_char = options.paddingChar,
            pad_val = options.paddingSize;
        
        
        
        if (cur_depth > 0) {
            cur_depth++;
        }
        
        if ((maxDepthLevel > 0)
            && (cur_depth >= maxDepthLevel)) {
            str += '*MAX DEPTH REACHED*\n';
            return str;
        }

        base_pad = _repeat_char(pad_val * (cur_depth - 1), pad_char);
        thick_pad = _repeat_char(pad_val * (cur_depth + 1), pad_char);

        if (typeof obj === 'object' && obj !== null) {
            if (alreadyRecursed.indexOf(obj) !== -1) {
                str += '*RECURSION*\n';
                return str;
            }
            alreadyRecursed.push(obj);
            
            isArray = obj instanceof Array;
            
            if (isArray) {
                lgth = obj.length;
                str += 'array';
            } else {
                lgth = 0;
                for (someProp in obj) {
                    lgth++;
                }
                str += 'object';
            }
            
            str += '(' + lgth + ') ' + (isArray ? '[' : '{') + '\n';
            for (key in obj) {
                objVal = obj[key];
                if (typeof objVal === 'object' && objVal !== null && !(objVal instanceof Date) && !(objVal instanceof RegExp)) {
                  str += (
                    thick_pad + (isArray ? '[' : '') + key + (isArray ? ']' : '') + ': ' + _formatArray(objVal, cur_depth + 1, options, alreadyRecursed));
                } else {
                  val = _getInnerVal(objVal, thick_pad, options);
                  str += thick_pad + (isArray ? '[' : '') + key + (isArray ? ']' : '') + ': ' + val + '\n';
                }
            }
            str += base_pad + (isArray ? ']' : '}') + '\n';
        } else {
            str = _getInnerVal(obj, thick_pad, options);
        }
        return str;
    }

    function _splitOnTruncate(raw, splitSize) {
        var splitRegExp = new RegExp('([\\S\\s]{1,' + splitSize + '})', 'g'),
            output,
            total;
        
        output = raw.match(splitRegExp);
        
        total = output.length;
        if (total < 2) return output;
        
        output.forEach(function (part, i) {
            output[i] = '[' + (i + 1) + '/' + total + ']\n' + part;
        });
        
        return output;
    }
    
    //varDump public interface
    return function varDump(obj, message, options) {
        var LOG_MAX_SIZE = 9000, //azure safe max size
            output = '',
            splitted,
            i = 0;
            
        
        (message && (message += '\n')) || (message = '');
        options || (options = {});
        
        if (typeof options.maxDepthLevel !== 'number') options.maxDepthLevel = 0;
        if (typeof options.paddingChar !== 'string') options.paddingChar = ' ';
        if (typeof options.paddingSize !== 'number') options.paddingSize = 2;
        
        
        output = message + _formatArray(obj, 0, options, []);

        if (console && console.log) {
            if (options.splitOnTruncate) {
                splitted = _splitOnTruncate(output, LOG_MAX_SIZE);
                splitted.forEach(function (logPart) {
                    console.log(logPart);
                });
            } else {
                console.log(output);
            }
        }

        return output;
    };
}());
