require('dotenv').config();

const Telegraf = require("telegraf");
const Extra = require("telegraf/extra");
const Markup = require("telegraf/markup");
const request = require("request");
const Storage = require("dom-storage");

const opts = {
    reply_markup: {
        keyboard: [
            [{
                text: "Send my location",
                request_location: true
            }]
        ],
        resize_keyboard: true
    }
}

const ltaDataMallKey = process.env.LTA_DATAMALL_KEY
const allBusStopURL = process.env.ALL_BUS_STOP_URL
const bot = new Telegraf(process.env.BOT_TOKEN, {
    polling: true
})
const HelpString = 'Please send the bus stop code (xxxxx), E.G. 72071 or both bus stop code and bus number (xxxxx bbb), E.G. 72071 21'


var localStorage = new Storage("//tmp//db.json", {
  strict: false,
  ws: "  ",
});

bot.start((ctx) => {
  try {
    let id = ctx.update.message.from.id;
    returnText(ctx, "Welcome! " + HelpString, id);
  } catch (err) {}
});

bot.command("help", (ctx) => ctx.reply(HelpString));
bot.command("Help", (ctx) => ctx.reply(HelpString));
bot.command("/help", (ctx) => ctx.reply(HelpString));

bot.on("text", (ctx) => {
  try {
    if (ctx.message.text === "Remove") {
      let id = ctx.update.message.from.id;
      let removeKeyboard = setRemoveKeyboard(id);
      return ctx.reply("Please click what to remove.", removeKeyboard);
    } else if (ctx.message.text.indexOf("Remove") == -1 ? false : true) {
      let arrayMessage = ctx.message.text.split(" ");

      if (arrayMessage.length > 2) {
        stopToRemove = arrayMessage[1];
        stopToRemove += " " + arrayMessage[2];
      } else {
        stopToRemove = arrayMessage[1];
      }
      let id = ctx.update.message.from.id;
      removeFromFav(id, stopToRemove);
      let removeKeyboard = setRemoveKeyboard(id);
      if (removeKeyboard.reply_markup.keyboard.length > 1) {
        return ctx.reply("Done removing!", removeKeyboard);
      } else {
        return ctx.reply("There is no more saved stops!", opts);
      }
    } else if (ctx.message.text === "Done") {
      let id = ctx.update.message.from.id;
      returnText(ctx, "Welcome! " + HelpString, id);
    } else {
      ctx.reply("Wait ah...");
      handleText(ctx);
    }
  } catch (err) {}
});

bot.on("location", (ctx) => {
  try {
    ctx.reply("Wait ah...");
    handleLocation(ctx);
  } catch (err) {}
});

bot.on("callback_query", (ctx) => {
  let favStop = ctx.callbackQuery.data;
  let id = ctx.update.callback_query.from.id;

  let check = false;
  let favStops = [];
  favStops = localStorage.getItem(id);
  if (favStops) {
    favStops.forEach(function (oneStop) {
      if (oneStop === favStop) {
        check = true;
      }
    });
  } else {
    favStops = [];
  }
  if (!check) {
    favStops.push(favStop);
    localStorage.setItem(id, favStops);
    returnText(ctx, "The bus stop code has been added!", id);
  } else {
    returnText(ctx, "Aiyoo! The bus stop code there already!", id);
  }
});

function removeFromFav(id, toRemoveFav) {
  let favStops = [];
  favStops = localStorage.getItem(id);
  let newFavStops = [];
  if (favStops) {
    for (var i = 0; i < favStops.length; i++) {
      if (favStops[i] !== toRemoveFav) {
        newFavStops.push(favStops[i]);
      }
    }
  }
  localStorage.setItem(id, newFavStops);
}

function setKeyboard(id) {
  let favStops = localStorage.getItem(id);
  let newOpts = {
    reply_markup: {
      keyboard: [
        [
          {
            text: "Send my location",
            request_location: true,
          },
        ],
      ],
      resize_keyboard: true,
    },
  };
  if (favStops) {
    if (favStops.length > 0) {
      favStops.forEach(function (oneStop) {
        newOpts.reply_markup.keyboard.push([
          {
            text: oneStop,
          },
        ]);
      });
      newOpts.reply_markup.keyboard.push([
        {
          text: "Remove",
        },
      ]);
    }
  }
  return newOpts;
}

function setRemoveKeyboard(id) {
  let favStops = localStorage.getItem(id);
  let newOpts = {
    reply_markup: {
      keyboard: [],
      resize_keyboard: true,
    },
  };
  if (favStops) {
    favStops.forEach(function (oneStop) {
      newOpts.reply_markup.keyboard.push([
        {
          text: "Remove " + oneStop,
        },
      ]);
    });
  }
  newOpts.reply_markup.keyboard.push([
    {
      text: "Done",
    },
  ]);
  return newOpts;
}

function returnText(varCtx, message, id) {
  try {
    let keyboard = setKeyboard(id);
    varCtx.reply(message, keyboard);
  } catch (err) {}
}

function returnTextWithInline(
  varCtx,
  inlineMessageRatingKeyboard,
  message,
  id
) {
  try {
    let keyboard = setKeyboard(id);
    varCtx.reply(message, inlineMessageRatingKeyboard, keyboard);
  } catch (err) {}
}

function returnHtmlText(varCtx, message, id) {
  try {
    let keyboard = setKeyboard(id);
    varCtx.replyWithHTML(message, keyboard);
  } catch (err) {
    console.log(err);
  }
}

function arePointsNear(checkPoint, centerPoint, km) {
    var ky = 40000 / 360
    var kx = Math.cos(Math.PI * centerPoint.lat / 180.0) * ky
    var dx = Math.abs(centerPoint.lng - checkPoint.lng) * kx
    var dy = Math.abs(centerPoint.lat - checkPoint.lat) * ky

    return Math.sqrt(dx * dx + dy * dy) <= km
}

function getBus(text) {
  return new Promise(function (resolve, reject) {
    var url =
      "http://datamall2.mytransport.sg/ltaodataservice/BusArrivalv2?BusStopCode=";
    let resultString = httpGet(url + text);
    resultString.then(function (result) {
      resolve(result.Services);
    });
  });
}

function getAllBusStop() {
    return new Promise(function (resolve, reject) {

        let resultString = httpGet(allBusStopURL)
        resultString.then(function (result) {
            resolve(result)
        })
        
    })
}

async function asyncForEach(array, callback) {
  for (let key in array) {
    await callback(array[key], key, array);
  }
}

async function handleLocation(varCtx) {
  let id = varCtx.update.message.from.id;

  try {
       varCtx.reply("Getting all bus stops within 250m radius.");
        var output = "";
        var d = new Date();
        var localTime = d.getTime();

        let centerPoint = {
          lat: varCtx.message.location.latitude,
          lng: varCtx.message.location.longitude,
        };

        output += "==========================" + "\n";
        let allBusStop = await getAllBusStop()
        let counter = 0;
        await asyncForEach(allBusStop, async (busStop) => {
            let checkedPoint = {
                lat: busStop.Latitude,
                lng: busStop.Longitude
            }
            if (arePointsNear(checkedPoint, centerPoint, 0.25)) {               
                counter++
                output += '<a href="https://www.google.com/maps/search/?api=1&query=' + busStop.Latitude + ',' + busStop.Longitude + '">' + busStop.Description + '  (' + busStop.BusStopCode + ')</a>' + '\n'
                let busServices = await getBus(busStop.BusStopCode)
                busServices.sort(function (a, b) {
                    return a.ServiceNo - b.ServiceNo
                })
                if (busServices.length == 0){
                    output += "No service available"+ '\n\n'
                }else{
                    for (const bus of busServices) {
                        output += writeText(bus, localTime) + '\n\n'
                    }
                }
                output += '==========================' + '\n'
            }
        })
        if(counter>0){
            returnHtmlText(varCtx, output, id)
        }else{
            returnHtmlText(varCtx, 'There is no bus stop nearby!', id)
        }
    }catch(err){
        console.log(err)
        returnText(varCtx, 'An error occurred! Pleas try again later!', id)
    }
}

async function checkBusStop(busStopNumber){
    let allBusStop = await getAllBusStop()
    let result = false;
    await asyncForEach(allBusStop, async (busStop) => {
        if( busStop.BusStopCode === busStopNumber){
            result = true
        }
    })
    return result
}

async function handleText(varCtx) {
    var text = varCtx.message.text
    var d = new Date()
    var splitString = []
    // convert to msec since Jan 1 1970
    var localTime = d.getTime()
    let output = ''
    let id = varCtx.update.message.from.id
    try {
        if (text.length === 5) {
            if (!isNaN(text)) {
                let busServices = await getBus(text)
                if (busServices.length != 0) {
                    busServices.sort(function (a, b) {
                        return a.ServiceNo - b.ServiceNo
                    })
                    busServices.forEach(function (element) {
                        output += writeText(element, localTime) + '\n\n'
                    })

                    const inlineMessageRatingKeyboard = Markup.inlineKeyboard([
                        Markup.callbackButton('⭐Favourite', text)
                    ]).extra()
                    
                    returnTextWithInline(varCtx, inlineMessageRatingKeyboard, output, id)
                    //returnText(varCtx, output)
                    return
                } else {
                    if(await checkBusStop(text)){
                        output='Aiyoo! So late until no more bus liao!'
                        const inlineMessageRatingKeyboard = Markup.inlineKeyboard([
                            Markup.callbackButton('⭐Favourite', text)
                        ]).extra()
                        returnTextWithInline(varCtx, inlineMessageRatingKeyboard, output, id)
                    }else{
                        returnText(varCtx, 'Aiyoo! You sure the bus stop code correct???',id)
                        return
                    }
                }

            } else {
                returnText(varCtx, 'Aiyoo! ' + HelpString, id)
                return
            }
        } else {
            splitString = text.split(' ')

            if (splitString[0].length != 5) {
                returnText(varCtx, 'Aiyoo! ' + HelpString, id)
                return
            }
            let busServices = await getBus(splitString[0])
            if (busServices.length != 0) {
                busServices.sort(function (a, b) {
                    return a.ServiceNo - b.ServiceNo
                })
                busServices.forEach(function (element) {
                    if (element.ServiceNo == splitString[1]) {
                        output += writeText(element, localTime)
                        const inlineMessageRatingKeyboard = Markup.inlineKeyboard([
                            Markup.callbackButton('⭐Favourite', text)
                        ]).extra()
                        returnTextWithInline(varCtx, inlineMessageRatingKeyboard, output, id)
                        //returnText(varCtx, output)
                        return
                    }
                })

                if (output === '') {
                    returnText(varCtx, 'Aiyoo! You sure the bus stop got the bus???', id)
                }
                return
            } else {
                returnText(varCtx, 'Aiyoo! You sure the bus stop code correct???', id)
                return
            }

        }

    } catch (error) {
        console.log(error)
        returnText(varCtx, 'Aiyoo! ' + HelpString, id)
    }
}


function formatText(diffMins, nextBus) {
  let temp = "";
  if (diffMins <= 0) {
    temp += "Arriving";
  } else {
    if (diffMins == 1) {
      temp += diffMins + "min";
    } else {
      temp += diffMins + "mins";
    }
  }
  temp += "\t";
  switch (nextBus.Load) {
    case "SEA":
      temp += "💚";
      break;

    case "SDA":
      temp += "⚠️";
      break;

    case "LSD":
      temp += "❌";
      break;
  }

  if (nextBus.Feature === "WAB") {
    temp += "\t";
    temp += "♿";
  }
  temp += "\t";
  temp += nextBus.Type;

  return temp;
}

function writeText(element, nd) {
  let datetime = new Date(element.NextBus.EstimatedArrival);
  let diffMins = Math.round((((datetime - nd) % 86400000) % 3600000) / 60000);
  let busNo = element.ServiceNo;

  switch (busNo.length) {
    case 1:
      busNo += "\v\v\v\v\v\v\v";
      break;

    case 2:
      busNo += "\v\v\v\v\v";
      break;

    case 3:
      busNo += "\v\v\v";
      break;

    case 4:
      busNo += " ";
      break;

    default:
      break;
  }

  let busText = "Bus: " + busNo + "\t|\v\v";

  busText += formatText(diffMins, element.NextBus);

  if (element.NextBus2.EstimatedArrival != "") {
    datetime = new Date(element.NextBus2.EstimatedArrival);

    diffMins = Math.round((((datetime - nd) % 86400000) % 3600000) / 60000);
    busText += "\n";
    busText += "\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t|\v\v";
    busText += formatText(diffMins, element.NextBus2);
  }
  if (element.NextBus3.EstimatedArrival != "") {
    datetime = new Date(element.NextBus3.EstimatedArrival);

    diffMins = Math.round((((datetime - nd) % 86400000) % 3600000) / 60000);
    busText += "\n";
    busText += "\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t|\v\v";
    busText += formatText(diffMins, element.NextBus3);
  }

  return busText;
}

function httpGet(theUrl) {
  try {
    return new Promise(function (resolve, reject) {
      request(
        theUrl,
        {
          headers: {
            AccountKey: ltaDataMallKey,
          },
        },
        function (error, res, body) {
          if (!error && res.statusCode == 200) {
            try {
              resolve(JSON.parse(body));
            } catch (err) {
              resolve("");
            }
          } else {
            resolve("");
          }
        }
      );
    }).catch(function (reason) {
      resolve("");
      return;
    });
  } catch (err) {
    resolve("");
  }
}

process.on("unhandledRejection", () => {});
process.on("rejectionHandled", () => {});

bot.startPolling();
