 var BarcodeListener = (function(window, document) {
        var BarcodeListener = function(options) {
            if (BarcodeListener.instance) {
                return BarcodeListener.instance;
            } else {
                var _that = this;
                this.init(options);
                var publicMembers = {
                    'constructor': BarcodeListener,
                    enable: function() {
                        _that.startListenSequence();
                    },
                    disable: function() {
                        _that.stopListenSequence();
                    },
                    toString: function() {
                        return "[object BarcodeListener]";
                    },
                    setInstance: function() {
                        BarcodeListener.instance = this;
                    }
                }
                publicMembers.setInstance();
                return publicMembers;
            }
        };

        BarcodeListener.prototype.init = function(options) {
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
            this.listenStarted = false;
            this.keyUpHandler = this.onKeyUp.bind(this);

            if (this.options.debug) {
                console.log('barcode:  -- Initialized --');
            }

            if (this.options.autoStart) {
                this.startListenSequence();
            }

        }

        BarcodeListener.prototype.extendConfig = function(defaultOptions, options) {
            for (var key in options) {
                if (options.hasOwnProperty(key)) {
                    defaultOptions[key] = options[key];
                }
            }
            return defaultOptions;
        };

        BarcodeListener.prototype.fire = function(str) {
            document.dispatchEvent(new CustomEvent(
                'barcode', {
                    detail: {
                        sequence: str,
                        onTextField: this.onTextField
                    }
                }));
        }

        BarcodeListener.prototype.tabSequence2barcode = function(sequence) {
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

        BarcodeListener.prototype.reset = function() {
            this._buffer = [];
            this.onTextField = null;
        }

        BarcodeListener.prototype.setWatcher = function() {
            this.watcher = setTimeout(function() {
                this.watcher = null;
                this.captureSequenceComplete();
            }.bind(this), this.options.maxKeyboardDelay);
        };

        BarcodeListener.prototype.clearWatcher = function() {
            if (this.watcher !== null) {
                clearTimeout(this.watcher);
            }
            this.watcher = null
        }

        BarcodeListener.prototype.startListenSequence = function() {
            if (this.listenStarted) {
                return;
            }
            this.listenStarted = true;
            document.addEventListener('keyup', this.keyUpHandler, false);

            if (this.options.debug) {
                console.log('barcode:  -- Listen Sequence Started --');
            }
        }

        BarcodeListener.prototype.stopListenSequence = function() {
            if (!this.listenStarted) {
                return;
            }
            this.listenStarted = false;
            document.removeEventListener('keyup', this.keyUpHandler, false);
            if (this.options.debug) {
                console.log('barcode:  -- Listen Sequence Stopped --');
            }

        BarcodeListener.prototype.captureSequenceComplete = function() {
            if (this.options.debug) {
                console.log('barcode:  -- Capture Completed --');
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

        BarcodeListener.prototype.onKeyUp = function(e) {
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
        }

        BarcodeListener.prototype.isInputTarget = function(event) {
            var textFields = [
                'input',
                'textarea',
            ];
            this.onTextField = textFields.indexOf(
                event.target.tagName.toLowerCase()
            ) !== -1;
        };
        return BarcodeListener;
    })(window, document);
