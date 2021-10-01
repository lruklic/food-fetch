var express = require('express');
const puppeteer = require('puppeteer')
const http = require('http');
const cron = require('node-cron');

var router = express.Router();

router.use(express.json());

var globalStorage = {"menuToday" : {}};

cron.schedule('20 09 * * 1-5', function() {
  console.log("Fetching daily data for lunch");
  fetchData();
});

/* GET home page. */
router.get('/fetch', function(req, res, next) {
  fetchData().then(function(todayMeals) {
    res.render('index', { title: JSON.stringify(todayMeals, null) });
  });
});

router.post('/fetch', function(req, res, next) {
  globalStorage.menuToday = req.body;
  res.send(200);
});

function fetchData() {
  var todayMeals = {"rhouse" : [], "spareribs" : []};

  return new Promise((resolve, reject) => {

/*     ocr().then(function(ocrBody) {
      for (var i = 0; i < ocrBody.length; i++) { 
        todayMeals["spareribs"].push(ocrBody[i]);
      }
      globalStorage.menuToday = todayMeals;
      return resolve(todayMeals);
    }); */

    screenshot().then(function(body) {
      for (var i = 1; i < body.length; i++) { 
        if (body[i].indexOf("SVAKODNEVNO") > -1) break;
        todayMeals["rhouse"].push(body[i]);
      }
  
      ocr().then(function(ocrBody) {
        for (var i = 0; i < ocrBody.length; i++) { 
          todayMeals["spareribs"].push(ocrBody[i]);
        }
        globalStorage.menuToday = todayMeals;
  
        return resolve(todayMeals);
      });
    }); 

  });

}

router.get('/json', function(req, res, next) {
  res.json(globalStorage);
});

async function ocr() {

  return new Promise((resolve, reject) => {

    // TODO read image link from their page
    var options = {
      host: 'api.ocr.space',
      path: '/parse/imageurl?apikey=e4d9ec26e888957&url=https://i.ibb.co/Qr9Srqm/White-on-Black-Chalkboard-Photo-Monthly-Menu-1.jpg&language=hrv&scale=true'
    };
  
    callback = function(response) {
      var str = '';
    
      //another chunk of data has been received, so append it to `str`
      response.on('data', function (chunk) {
        str += chunk;
      });
    
      //the whole response has been received, so we just print it out here
      response.on('end', function () {
        var lines = str.split("\\r\\n");
  
        var day = 0;
        var menu = {"0" : [], "1" : [], "2" : [], "3" : [], "4" : []};
        var multilineMeal = "";
  
        for (var i = 2; i < lines.length; i++) {  // skip metadata 0 and dates 1
          
          if (lines[i].replace(/\s/g, '').startsWith("KREMŠNITA") || lines[i].replace(/\s/g, '').startsWith("CHEESECAKE") || 
                lines[i].replace(/\s/g, '').startsWith("ALKAZAR") || lines[i].replace(/\s/g, '').startsWith("DODATAK")) {
                  continue;
          }

          if (lines[i].indexOf("SearchablePDFURL") > -1) {
            break;
          }
  
          // TODO check similarities
          if (lines[i].replace(/\s/g, '') == "PONEDJELJAK") {
            day = 0;
            continue;
          } else if (lines[i].replace(/\s/g, '') == "UTORAK") {
            day = 1;
            continue;
          } else if (lines[i].replace(/\s/g, '') == "SRIJEDA") {
            day = 2;
            continue;
          } else if (lines[i].replace(/\s/g, '') == "ČETVRTAK") {
            day = 3;
            continue;
          } else if (lines[i].replace(/\s/g, '') == "PETAK") {
            day = 4;
            continue;
          }
  
          multilineMeal += lines[i];
  
          var priceReg = /([0-9]{1,2},)/g;
          if (multilineMeal.match(priceReg) != null) {
            menu[day].push(multilineMeal);
            multilineMeal = "";
            continue;
          } else {
            multilineMeal += " ";
          }
  
        }
  
        console.log(menu);
        console.log(new Date().getDay());

        resolve(menu[new Date().getDay() - 1]);
      });
    }
  
    http.request(options, callback).end();
  });

}

async function screenshot(){

    const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
    const page = await browser.newPage()	
    await page.setViewport({ width: 1366, height: 768});
  
    // Load FB rhouse content
    await page.goto('https://facebook.com')
    console.log("Waiting for FB load")
    await page.screenshot({path: 'state1.png'});  
    await page.waitForTimeout(2000)
    await page.click('button[data-testid="cookie-policy-dialog-accept-button"]');
    console.log("Waiting for input")
    await page.waitForTimeout(2000);
    await page.screenshot({path: 'state2.png'});  
    await page.$eval('#email', el => el.value = 'inge.brismarc@protonmail.com');
    await page.waitForTimeout(2245);
    await page.$eval('#pass', el => el.value = 'Brzosamnazad!!');
    await page.screenshot({path: 'state3.png'});  
    await page.waitForTimeout(1100);
    await page.click('button[data-testid="royal_login_button"]');
    console.log("Waiting for load")
    await page.waitForTimeout(5500);
  
    await page.goto('https://www.facebook.com/rhousezg')
    await page.waitForTimeout(7000);
    await page.screenshot({path: 'state4.png'});  
    console.log("Search for latest post");
  
    let result = await page.evaluate(() => new Promise((resolve) => {
      //debugger;
      console.log("Entered the evaluate")
      var buttons = document.querySelectorAll('div[role="button"]');
  
      var seeMoreButtons = [];
      for (var i = 0; i < buttons.length; i++) {
        if (buttons[i].textContent.toLocaleLowerCase() == "prikaži više" || buttons[i].textContent.toLocaleLowerCase() == "see more") { 
          seeMoreButtons.push(buttons[i]) 
        };
      }
    
      if (seeMoreButtons[1]) {
        var postParent = seeMoreButtons[1].parentElement.parentElement.parentElement;
        seeMoreButtons[1].click();
        var lines = [];
      
        setTimeout(function(){
          for (var i = 0; i < postParent.children.length; i++) { 
            var line = "";
            for (var j = 0; j < postParent.children[i].children.length; j++) {
              var content = postParent.children[i].children[j].textContent;
              line += content + "\n";
            }
            lines.push(line);
          }
    
          console.log(lines);
          return resolve(lines);
          
        }, 1500);
      } else {
        return resolve([]);
      }

    }));
  
    await page.waitForTimeout(2000);
  
    await browser.close()

    return result;

}

module.exports = router;