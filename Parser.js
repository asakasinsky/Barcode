// @ts-check
var GS1_BarcodeParser = (function (window, document) {
    'use strict';
    var Utils = {
        /**
         * Вырезает пробельные символы в начале и конце строки,
         * не меняя значения самой строки
         * @param {string} str 
         */
        trim: function (str) {
            return str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
        }
    };

    var BarcodeExceptions = {
        becauseBarcodeIsEmpty: function () {
            return {
                name: 'BarcodeException',
                message: 'Barcode is empty'
            };
        },

        becauseNoDataPresent: function () {
            return {
                name: 'BarcodeException',
                message: 'Barcode does not contain data'
            };
        },

        /**
         * @param {string} aiCode 
         * @param {number} expectedLength 
         * @param {number} actualLength 
         */
        becauseNotEnoughDataForAI: function (aiCode, expectedLength, actualLength) {
            return {
                name: 'BarcodeException',
                message: [
                    'Not enough data for AI ',
                    aiCode,
                    ': ',
                    expectedLength,
                    ' expected but ',
                    actualLength,
                    ' exists'
                ].join('')
            };
        },

        /**
          * @param {string} aiValue 
          */
        becauseGroupSeparatorWasNotExpected: function (aiValue) {
            return {
                name: 'BarcodeException',
                message: [
                    'Group separator was not expected in AI ',
                    aiValue
                ].join('')
            };
        },
    };

    /**
     * 
     * @param {string} content 
     * @param {{}} ais 
     * @param {string[]} buffer 
     * @param {import("./typings/parser").GS1_FNC1}  fnc1Prefix 
     * 
     * @returns {import("./typings/parser").GS1_Barcode}
     */
    var Barcode = function (content, ais, buffer, fnc1Prefix) {
        return {
            ais: ais,
            content: content,
            buffer: buffer,
            fnc1Prefix: fnc1Prefix,
            hasAI: function (aiCode) {
                return typeof this.ais[aiCode] !== 'undefined';
            }
        }
    }

    var Parser = {
        GS1_SEPARATOR: String.fromCharCode(29),
        GS1_FNC1: {
            'DATAMATRIX_SEQUENCE': ']d2',
            'QRCODE_SEQUENCE': ']Q3',
            'EAN_SEQUENCE': ']e0',
            '128_SEQUENCE': ']C1',
        },
        FIXED_LENGTH_AIS: {
            '00': 20,
            '01': 16,
            '02': 16,
            '03': 16,
            '04': 18,
            '11': 8,
            '12': 8,
            '13': 8,
            '14': 8,
            '15': 8,
            '16': 8,
            '17': 8,
            '18': 8,
            '19': 8,
            '20': 4,
            '31': 10,
            '32': 10,
            '33': 10,
            '34': 10,
            '35': 10,
            '36': 10,
            '41': 16,
        },
        FIXED_AI_CODE_LENGTH: 2,

        knownAIs: [],

        /**
         * 
         * @param {array} ais 
         * 
         */
        setKnownAIs: function (ais) {
            this.knownAIs = [];
            for (var i = 0; i < ais.length; i++) {
                this.knownAIs.push(ais[i]);
            }
        },

        /**
         * @param {string} data 
         * @returns {GS1_FNC1} 
         */
        fetchFNC1Prefix: function (data) {
            // @ts-ignore
            return (data.charAt(0) === ']') ? data.substring(0, 3) : '';
        },

        /**
         * @param {string} data 
         * @returns {string} 
         */
        removeFNC1Prefix: function (data) {
            return (data.charAt(0) === ']') ? data.substring(3, data.length) : data;
        },

        /**
         * @param {string} data 
         * @param {number} currentPosition 
         * @param {number} dataLength 
         * 
         * @returns {{code: string, length: number, codeLength: number} | null}
         */
        lookupFixedAIInfo: function (data, currentPosition, dataLength) {
            if (dataLength - currentPosition < this.FIXED_AI_CODE_LENGTH) {
                return null;
            }
            var ai = data.substring(currentPosition, currentPosition + this.FIXED_AI_CODE_LENGTH);
            var aiLength = this.FIXED_LENGTH_AIS[ai];
            if (typeof aiLength === 'undefined') {
                return null;
            }
            return {
                code: ai,
                length: aiLength,
                codeLength: this.FIXED_AI_CODE_LENGTH,
            };
        },

        /**
         * 
         * @param {string} data 
         * @param {number} currentPosition 
         * 
         * @returns {{code: string, length: number|null, codeLength: number} | null}
         */
        lookupKnownAI: function (data, currentPosition) {
            var aiLength;
            var ai;
            for (var i = 0; i < this.knownAIs.length; i++) {
                aiLength = this.knownAIs[i].length;
                ai = data.substring(currentPosition, currentPosition + aiLength);
                if (this.knownAIs[i] === data.substring(currentPosition, currentPosition + aiLength)) {
                    return {
                        code: ai,
                        codeLength: aiLength,
                        length: null
                    };
                }
            }
            return null;
        },

        /**
         * 
         * @param {string} data 
         * 
         * @returns {GS1_Barcode}
         */
        parse: function (data) {
            var currentPosition = 0;
            var dataLength;
            var ai;
            var aiValue;
            var aiCode;
            var aiCodeLength;
            var aiLength;
            var groupSeparatorPosition;
            var buffer = [];
            var ais = {};

            data = Utils.trim(data);
            if (data === '') {
                throw BarcodeExceptions.becauseBarcodeIsEmpty();
            };

            var fnc1Prefix = this.fetchFNC1Prefix(data);
            currentPosition = fnc1Prefix.length;
            dataLength = data.length;

            if (dataLength <= currentPosition) {
                throw BarcodeExceptions.becauseNoDataPresent();
            }

            var count = 0;
            while (dataLength > currentPosition) {
                count++;
                if (count > 5) {
                    break;
                }
                ai = this.lookupFixedAIInfo(data, currentPosition, dataLength);

                aiValue = null;
                if (ai) {
                    // FIXED AI LENGTH
                    aiCodeLength = ai.codeLength;
                    aiCode = ai.code;
                    aiLength = ai.length;
                    if (currentPosition + aiLength > dataLength) {
                        throw BarcodeExceptions.becauseNotEnoughDataForAI(
                            aiCode,
                            aiLength,
                            dataLength - currentPosition
                        );
                    }
                    if (this.knownAIs.indexOf(aiCode) > -1) {
                        aiValue = data.substring(
                            currentPosition + aiCodeLength,
                            currentPosition + aiLength
                        );
                    } else {
                        aiCode = null;
                        aiValue = data.substring(
                            currentPosition,
                            currentPosition + aiLength
                        );
                    }
                    if (aiValue.indexOf(this.GS1_SEPARATOR) !== -1) {
                        throw BarcodeExceptions.becauseGroupSeparatorWasNotExpected(aiValue);
                    }
                    currentPosition += aiLength;
                } else {
                    // DYNAMIC AI LENGTH
                    ai = this.lookupKnownAI(data, currentPosition);

                    groupSeparatorPosition = data.substring(currentPosition, dataLength).indexOf(this.GS1_SEPARATOR);
                    if (groupSeparatorPosition > -1) {
                        aiLength = groupSeparatorPosition;
                    } else {
                        aiLength = dataLength - currentPosition;
                    }
                    if (ai) {
                        aiCode = ai.code;
                        aiCodeLength = ai.codeLength;
                        aiValue = data.substring(currentPosition + aiCodeLength, currentPosition + aiLength);
                        aiCode = data.substring(currentPosition, currentPosition + aiCodeLength)
                    } else {
                        aiCode = null;
                        aiValue = data.substring(currentPosition, currentPosition + aiLength);

                    }

                    currentPosition += aiLength + this.GS1_SEPARATOR.length;
                }
                if (aiCode) {
                    ais[aiCode] = aiValue;

                } else {
                    buffer.push(aiValue);
                }
            }
            return Barcode(
                data,
                ais,
                buffer,
                fnc1Prefix
            );
        }
    }

    return {
        /**
         * Сообщаем какие идентификаторы будут парситься —
         * — по дефолту парсер ничего не о них знает
         * @param {string[]} ais ожидаемые идентификаторы
         * 
         * @example
         * 
         *      GS1_BarcodeParser.setKnownAIs(['01', '21']);
         */
        setKnownAIs: function (ais) {
            return Parser.setKnownAIs(ais);
        },
        /**
         * 
         * @param {string} data  символьная последовательность штрих-кода
         * 
         * @returns {import("./typings/parser").GS1_Barcode} GS1_Barcode (объект штрих-кода)
         */
        parse: function (data) {
            return Parser.parse(data);
        },
    };
})(window, document);
