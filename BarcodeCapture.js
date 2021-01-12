var BarcodeCapture = (function(document) {
    var BarcodeCapture = function(options) {
        if (BarcodeCapture.instance) {
            return BarcodeCapture.instance;
        } else {
            var _that = this;
            this.init(options);
            var publicMembers = {
                'constructor': BarcodeCapture,
                start: function() {
                    _that.startCapture();
                },
                stop: function() {
                    _that.stopCapture();
                },
                test: function(str) {
                    _that.test(str);
                },
                toString: function() {
                    return "[object BarcodeCapture]";
                },
                setInstance: function() {
                    BarcodeCapture.instance = this;
                }
            }
            publicMembers.setInstance();
            return publicMembers;
        }
    };

    BarcodeCapture.prototype.init = function(options) {
        this.options = this.extendConfig({
            debug: false,
            maxKeyboardDelay: 200,
            minLength: 5,
            ignoreInputs: false,
            autoStart: false,
        }, options);

        this.watcher = 0;
        this._buffer = []
        this.onTextField = null;
        this.captureStarted = false;
        this.keyUpHandler = this.onKeyUp.bind(this);

        if (this.options.debug) {
            console.log('barcode:  -- Initialized --');
        }

        if (this.options.autoStart) {
            this.startCapture();
        }

    }

    BarcodeCapture.prototype.extendConfig = function(defaultOptions, options) {
        for (var key in options) {
            if (options.hasOwnProperty(key)) {
                defaultOptions[key] = options[key];
            }
        }
        return defaultOptions;
    };

    BarcodeCapture.prototype.fire = function(str) {
        document.dispatchEvent(new CustomEvent(
            'barcode', {
                detail: {
                    sequence: str,
                    onTextField: this.onTextField
                }
            }));
    }

    BarcodeCapture.prototype.tabSequence2barcode = function(sequence) {
        // Вводные:
        // - последовательность кратна четырём (один ALT-Code)
        // - каждое число последовательности — ASCII-код символа
        // - каждый символ — часть числа
        // - в числе по три разряда
        // - после каждого числа идёт ASCII-код символа ALT
        // - трёхразрядное число - ASCII-код одного символа из barcode
        //
        // Для того, чтобы передать barcode 4607027767471, понадобится 13*4 ASCII-кодов.
        // Такая заморока нужна для того, чтобы в режиме эмуляции USB-HID клавиатуры
        // отсутствовало влияние текущей раскладки и передавались непечатные символы,
        // в частности, разделитель GS (код 29)
        // В инструкции к сканнеру этот режим называется «ALT+Number output»
        sequence = String.fromCharCode.apply(this, sequence);
        sequence = sequence.split('');
        // В конце последовательности ожидаем три символа:
        // - CR (13) — возврат каретки
        // - LF (10) — перевод строки
        // - NULL (пусто)
        var controlSuffix = sequence.splice(Math.max(sequence.length - 3, 1))
        if (controlSuffix.join('-') === '013-010-') {
            return String.fromCharCode.apply(this, sequence);
        }
        return null;
    };

    BarcodeCapture.prototype.reset = function() {
        this._buffer = [];
        this.onTextField = null;
    }

    BarcodeCapture.prototype.setWatcher = function() {
        this.watcher = setTimeout(function() {
            this.watcher = null;
            this.captureSequenceComplete();
        }.bind(this), this.options.maxKeyboardDelay);
    };

    BarcodeCapture.prototype.clearWatcher = function() {
        if (this.watcher !== null) {
            clearTimeout(this.watcher);
        }
        this.watcher = null
    }

    BarcodeCapture.prototype.startCapture = function() {
        if (this.captureStarted) {
            return;
        }
        this.captureStarted = true;
        document.addEventListener('keyup', this.keyUpHandler, false);

        if (this.options.debug) {
            console.log('barcode:  -- Capture Sequence Started --');
        }
    }

    BarcodeCapture.prototype.stopCapture = function() {
        if (!this.captureStarted) {
            return;
        }
        this.captureStarted = false;
        document.removeEventListener('keyup', this.keyUpHandler, false);
        if (this.options.debug) {
            console.log('barcode:  -- Capture Sequence Stopped --');
        }
    }

    BarcodeCapture.prototype.captureSequenceComplete = function() {
        if (this.options.debug) {
            console.log('barcode:  -- Sequence Captured --');
        }
        var barcode = null;
        if (this._buffer.length <= this.options.minLength) {
            this.reset();
            return;
        }
        barcode = this.tabSequence2barcode(this._buffer);
        if (barcode) {
            if (this.options.debug) {
                console.log('barcode:  -- Sequence: ' + barcode + ' --');
            }
            this.fire(barcode);
        }
        this.reset();
    }

    BarcodeCapture.prototype.onKeyUp = function(e) {
        this.isInputTarget(e);
        if (this.options.ignoreInputs) {
            if (this.onTextField) {
                this.reset();
                this.clearWatcher();
                return;
            }
        }
        if (this.watcher) {
            this.clearWatcher();
        }
        this._buffer.push(e.which);
        this.setWatcher();
    };

    BarcodeCapture.prototype.isInputTarget = function(event) {
        var textFields = [
            'input',
            'textarea',
        ];
        this.onTextField = textFields.indexOf(
            event.target.tagName.toLowerCase()
        ) !== -1;
    };
  
    BarcodeCapture.prototype.test = function (altCodeSsequence) {
        var body = document.body;
        var evt;
        var code;
        for (let i = 0; i < altCodeSsequence.length; i++) {
            code = altCodeSsequence[i].charCodeAt(0)
            evt = new KeyboardEvent('keyup', {
                'bubbles':true, 
                'keyCode':code, 
                'which':code
            }); 
          body.dispatchEvent(evt);
        }
    }

    return BarcodeCapture;
})(document);
