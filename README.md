## What Are The Problems?

- ПО на вебе. JavaScript. 
- Необходимо использовать сканер штрихкодов для сохранения маркировки в карточку товара.
- Используем режим эмуляции клавиатуры.
- Обнаруживаем влияние раскладки на код маркировки
- Обнаруживаем, что сканер не передаёт GS-разделитель.
  
## Problem Solving.

1. Перевести сканер в режим RS-232. Потребуется прокидывать данные с RS-232 к нашему окошку в браузере (веб-сокеты, через обёртку-Electron, или что там ещё есть).
2. Режим «ALT+Number output». **(Используется в данном решении)**
   1. Включаем на сканере режим эмуляции клавиатуры, режим «ALT+Number output». 
   2. Включаем добавление CR+LF в конец каждого считанного штрихкода. Это даст дополнительную уверенность того, что мы обрабатываем последовательность символов от сканера, а не клавиатуры.
   3. Реализуем на JS захват символьных последовательностей с клавиатуры.


##  TAB-Code Capturing From Barcode Scanner

Испольуемый сканер: Poscenter HH 2D HH.

Для отличия ввода сканера от человека обычно используются два решения:

1. Замер времени между нажатиями
    - Сканер «нажимает клавиши» быстрее обычного человека, набирающего текст. 
    - Определяемся со максимальной задержкой между нажатиями (maxKeyboardDelay), для примера — 100 миллисекунд.
    - После нажатия клавиши:
      -  вызываем setTimeout равным 100 миллисекундам и колбэком, который выполнится после сработки таймера.
      -  сохраняем в буфер полученный символ
    - Если в промежутке 100 миллисекунд произошло нажатие, то:
      - сохраняем в буфер полученный символ
      - удаляем таймер и устанавливаем новый.
    - Если по истечении 100 миллисекунд не было нажатия клавиши, то: 
      - проверяем количество сохранённых символов в буфере, и если: 
        - оно меньше заданного (например, три), очищаем буфер
        - иначе переводим полученную последовательность TAB-кодов в обычную ASCII-последовательность. Генерируем событие.

2. Префиксные (суффиксные) символы. Некоторые сканеры позволяют задать префиксы, по которым можно определить начало передачи последовательности от сканера. Суффикс позволяет определить конец передачи последовательности от сканера. Имеющиеся у нас в наличии сканеры не позволяют задать префиксы, но могут добавлять суффикс в виде символов CR и LF, что позволяет более точно определить ввод сканера. В решении эта возможность также используется.


## Usage Barcode Capture

Временной порог (maxKeyboardDelay) настраивается в конструкторе BarcodeCapture. Значение порога по-умолчанию равно 200 миллисекундам.

``` js
// Переданные в конструктор значения параметров соответствуют дефолтным значениям
var bs = new BarcodeCapture({
    // режим отладки
    debug: false,
    // временная задержка между символами
    maxKeyboardDelay: 200,
    // минимальная длина ожидаемой последовательности
    minLength: 5,
    // игнорировать ввод при активном курсоре внутри текстового поля. 
    ignoreInputs: false,
    // захват ввода сразу после создания экземпляра BarcodeCapture
    autoStart: false
});

// начать захват ввода
bs.start();

// остановить захват ввода
bs.stop();

// имитация ввода сканера для теста работы
// Копируй этот участок в исходнике. Парсер лох!!!
  var testALTcodes = [
    // штрихкод
    // 4604094039630
    // последовательность ALT-кодов 
    '052054048052048057052048051057054051048013010',

    // штрихкод 
    // 010290000028277321-\"rGXbl6qWR+f91003A92RtBA/X1r8sktUWZYUuLxsjypacUEGr9U3D0MitoczBkXQofXaKFq8Zy9BQ+Y5uW03+2dwmzf4NBW7ZTb7AGXEg==
    // последовательность ALT-кодов 
    '04804904805005704804804804804805005605005505505105004904503401140710880980108054011308708204301020290570490480480510650290570500820116066065047088049011405601150107011608508709008908501170760120011501060121011209709908506907101140570850510680480770105011601110990122066010708808101110102088097075070011305609001210570660810430890530117087048051043050010001190109012201020520780660870550900840980550650710880690103061061013010'
  ]
bs.test(testALTcodes[1])
```

После захвата последовательности, BarcodeCapture генерирует событие barcode на DOM-элементе document

```js
// barcode event
{
    detail: {
        // полученная последовательность 
        sequence: string,
        // признак ввода на текстовом поле
        onTextField: boolean
    }
}
```


Мы не можем предотвратить случайный ввод на текстовом поле, но мы можем определить это по признаку «onTextField».  
Можно в карточке товара разместить кнопку «Считать маркировку сканером». Нажатие этой кнопки сместит фокус с текстовых полей и не даст эмулированной сканером клавиатуре испортить набранное.

Пример:

```js
var bs = new BarcodeCapture({
    debug: true,
});

$('button').on('click', function() {
    bs.start();
});

// JQuery
$(document).on('barcode', function(e, str) {
    bs.stop()
    alert(e.detail.sequence);
});

// Vanilla JS
document.addEventListener('barcode', function(e) {
    bs.stop()
    alert(e.detail.sequence);
});
```

Бывает так, что рядом с маркировкой находятся другие штрихкоды. Мы можем предотвратить получение неправильного кода оператором (всякое бывает). Для этого можно полученную последовательность проверить парсером ([см. секцию Barcode Parser](https://github.com/asakasinsky/Barcode#barcode-parsing)), и, если не сошлось, то уведомить оператора.

## Пример решения.  
По нажатию кнопки «Считать маркировку сканером» включить захват, вывести модальное окно с краткой (!) инструкцией. Что-то типа образца DataMatrix штрихкода и надписи «Найдите на упаковке похожий штрихкод, наведите сканер и нажмите кнопку».  
После считывания проверить парсером код и, в случае успеха, скрыть блок инструкции и уведомить об успехе короткой фразой. Например, «код принят» или что-то в этом роде. По нажатию кнопки закрытия диалогового окна сохранить код маркировки в карточке.  
Если код не прошёл проверку парсером, то вывести что-то типа «Странный код маркировки. Нажмите OK, если вы уверены в правильности типа сканируемого штрихкода.»
Полученный код сохранить, но пометить в БД для последующей ручной проверки.  



## Barcode Parsing

``` js
// AI - GS1 Application Identifier 
// Ожидаемые AI в русской маркировке и их коды
var AIS = {
    GTIN: '01',
    SERIAL: '21',
    TNVED: '240',
    VALIDATION: '91',
    CRYPTO: '92',
    SSCC: '00',
};

//  Сообщаем какие идентификаторы будут парситься —
//  — по дефолту парсер ничего не о них знает
//      Пример:
//      GS1_BarcodeParser.setKnownAIs(['01', '21']);
GS1_BarcodeParser.setKnownAIs([
    AIS.GTIN,
    AIS.SERIAL,
    AIS.TNVED,
    AIS.VALIDATION,
    AIS.CRYPTO,
    AIS.SSCC,
]);

// Тестовый штрих-код
var code = ']d2010460702776747121000001KOL6P5Y910000920000000000000000000000000000000000000000000';

var barcode;
try {
    // смотри описание структуры barcode в ./typings/parser.d.ts
    barcode = GS1_BarcodeParser.parse(code)

    // Проверка по GTIN и SERIAL
    if (barcode && barcode.hasAI(AIS.GTIN) && barcode.hasAI(AIS.SERIAL)) {
        // Тут мы можем быть точно уверены, что штрих-код корректный 
        console.log('BARCODE IS VALID')
    }
} catch (e) {
    // Если мы здесь, то штрих-код некорректный
    console.log(e);
}
```
