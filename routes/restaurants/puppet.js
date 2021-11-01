var express = require('express');
const puppeteer = require('puppeteer')
const http = require('http');
const cron = require('node-cron');

var router = express.Router();

router.use(express.json());

var globalStorage = {"menuToday" : {"rhouse" : [], "spareribs" : []}};

cron.schedule('1 0 * * *', function() {
  console.log("Cleaning the menu from the previous day");
  globalStorage = {"menuToday" : {"rhouse" : [], "spareribs" : []}};
});

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

router.get('/fetch/restaurant/spareribs', function(req, res, next) {
    ocr().then(function(ocrBody) {
      for (var i = 0; i < ocrBody.length; i++) { 
        globalStorage.menuToday["spareribs"].push(ocrBody[i]);
      }
      res.json(globalStorage.menuToday["spareribs"]);
    });
});

router.get('/fetch/restaurants/rhouse', function(req, res, next) {
  rhouseFetch().then(function(body) {
    for (var i = 0; i < body.length; i++) { 
      if (body[i].toUpperCase().indexOf("SVAKODNEVNO") > -1) break;
      globalStorage.menuToday["rhouse"].push(body[i]);
    }
    res.json(globalStorage.menuToday["rhouse"]);
  })
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
      path: '/parse/imageurl?apikey=e4d9ec26e888957&url=https://i.ibb.co/cy2D2qh/245329501-2910546615872122-7645732243483599165-n.jpg&language=hrv&scale=true'
      timeout : 15000
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
  
        var day = -1;
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
          } else if (lines[i].replace(/\s/g, '') == "ČETVRTAK" || lines[i].replace(/\s/g, '') == "CETVRTAK") {
            day = 3;
            continue;
          } else if (lines[i].replace(/\s/g, '') == "PETAK") {
            day = 4;
            continue;
          }
  
          if (day == -1) {
            continue;
          }

          multilineMeal += lines[i];
  
          var priceReg = /([0-9]{1,2}[,|.])/g;
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

        var currentDay = new Date().getDay();
        if (currentDay == 0 || currentDay == 6) {
          currentDay = 0;
        } else {
          currentDay -= 1;
        }

        var currentDayMenu = menu[currentDay];
        
        if (currentDayMenu.length > 0) {
          currentDayMenu.forEach(function(menuItem, index) {
            var correctedItem = menuItem
              .replaceAll(" 1 ", " I ")
              .replaceAll(",oo", ",00")
              .replaceAll(",OO", ",00");
            this[index] = correctedItem; 
          }, currentDayMenu);
        }

        resolve(currentDayMenu);    
      });
    }
  
    const request = http.request(options, callback).end();

    request.on('timeout', function() {
      console.log("timeout occurred");
      request.end(); 
    })
  });

}

async function vujcaFetch() {
  const browser = await puppeteer.launch({ headless: false, devtools: true });
  var [page] = await browser.pages();
  await page.setViewport({ width: 1366, height: 768});
  await page.goto('https://jambresic.com/gableci/');
  await page.waitForNavigation();
}

async function rhouseFetch() {
  const browser = await puppeteer.launch({ headless: false, devtools: true });
  var [page] = await browser.pages();
  await page.setViewport({ width: 1366, height: 768});
  await page.goto('https://facebook.com/rhousezg');
  await page.waitForTimeout(5000);
  await page.click('button[data-testid="cookie-policy-dialog-accept-button"]');
  await page.waitForTimeout(3000);

  let result = await page.evaluate(() => new Promise((resolve) => {
    
    console.log("Actions on the page")
    
    console.log("Entered the evaluate")
    var buttons = document.querySelectorAll('a[class="see_more_link"]');

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
          //debugger;
          var line = "";
          if (postParent.children[i].nodeName == "P") {
            line = postParent.children[i].textContent;
          } else if (postParent.children[i].classList.value.indexOf("text_exposed_hide") > -1) {
            continue;
          } else {
            for (var j = 0; j < postParent.children[i].children.length; j++) {
              var content = postParent.children[i].children[j].textContent;
              lines.push(content.trim());
            }
          }

          lines.push(line);
        }
  
        console.log(lines);
        return resolve(lines);
        
      }, 2500);
    } else {
      return resolve([]);
    }

  }));

  await browser.close();

  return result;
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