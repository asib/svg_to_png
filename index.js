const puppeteer = require('puppeteer');
const yargs = require('yargs');
var fs = require('fs');

const argv = yargs
  .option('input', {
    alias: 'i',
    describe: 'path to svg file',
    type: 'string',
  })
  .option('size', {
    alias: 's',
    describe: 'size of png to generate',
    type: 'number',
  })
  .option('output', {
    alias: 'o',
    describe: 'path to output file',
    type: 'string',
  })
  .option('stdin', {
    describe: 'read input from stdin',
    type: 'boolean',
  })
  .option('stdout', {
    describe: 'write output to stdout',
    type: 'boolean',
  })
  .demandOption(['size'], 'Please provide the required arguments.')
  .conflicts('stdin', 'input')
  .conflicts('stdout', 'output')
  .help()
  .argv;

(async (argv) => {
  const browser = await puppeteer.launch({headless: true, args: ['--disable-gpu', '--no-sandbox']});
  const page = await browser.newPage();

  var svgFile;
  if (argv.stdin) {
    svgFile = 0;
  } else {
    svgFile = argv.input
  }
  const pngSize = argv.size;
  var svgData = '';
  try {
    const bytes = fs.readFileSync(svgFile, 'utf8');
    svgData = bytes.toString();
  } catch (e) {
    console.log(e);
    process.exit(1);
  }

  const html = `<html>
            <head>
                <style>
                    body { margin: 0; padding: 0; }
                </style>
            </head>
            <body>
                ${svgData}
            </body>
        </html>`;
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  await page.setContent(html, {waitUntil: 'domcontentloaded'});
  const data = await page.evaluate(async (size) => {
    //return Promise.resolve(convertToPNG(pngSize));
    var svg = document.getElementById('carbon-label-svg');

    // Label is a square, so only need one side.
    var currentSVGWidth = parseFloat(svg.getAttribute('width'));
    var currentSVGHeight = parseFloat(svg.getAttribute('height'));
    var scaleFactor = size*1.0 / currentSVGWidth;

    // Get the XML data only once transform has been applied.
    var svgData = new XMLSerializer().serializeToString(svg);

    var canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = currentSVGHeight / currentSVGWidth * size;
    var ctx = canvas.getContext("2d");

    //display image
    var img = document.createElement("img");
    img.setAttribute("src", "data:image/svg+xml;base64," + btoa(svgData));

    await new Promise((resolve) => {
      if (img.complete || (img.width) > 0) resolve();
      img.addEventListener('load', () => resolve());
    });

    ctx.scale(scaleFactor, scaleFactor);
    ctx.drawImage(img, 0, 0);
    return Promise.resolve(canvas.toDataURL("image/png"));
  }, pngSize);

  const prefix = 'data:image/png;base64,';
  const b64Data = data.replace(prefix, '');

  if (argv.stdout) {
    process.stdout.write(b64Data);
  } else {
    fs.writeFile(argv.output, b64Data, 'base64', (err) => {
      if (err) {
        console.log(err);
        process.exit(1);
      }
    });
  }

  await browser.close();
})(argv);
