//https://api.coinmarketcap.com/v1/ticker/shield-coin/

const Discord = require("discord.js"); //9.3.1
const Client = new Discord.Client();
const nosql = require("nosql");
const shield = require("./lib/shield")();
var db = nosql.load("uid.nosql");

var cmca = require('coinmarketcap-api');
var cmc = new cmca();

const algos = ["x17", "scrypt", "groestl", "lyra2re", "blake"];
var collectorAddr = "SHIELDADDRESS"; //must be on the same wallet
shield.auth('Macintyre, John', 'mypassword');

var jsonf;

cmc.getTicker({
	limit: 1,
	currency: 'shield-xsh'
}).then(x => {
	jsonf = x;
}).catch(console.error)

function Update() {

	cmc.getTicker({
		limit: 1,
		currency: 'shield-xsh'
	}).then(x => {
		jsonf = x;
	}).catch(console.error);

	db.find().make(function (builder) { //Get All users
		builder.callback(function (err, response) {
			response.forEach(function (element) { //Iterate through them
				shield.getreceivedbyaddress(element["deposit_address"], function (err, inf) {
					if (inf > element["ActualBalance"]) {
						db.modify({
							ActualBalance: inf
						}).make(function (builder) {
							builder.first(); // --> modifies only one document
							builder.where('deposit_address', element["deposit_address"]);
							builder.callback(function (err, count) {
								if (err) {
									console.log(err);
								}
								UpdateBalance(element["uid"], element["balance"] + (inf - element["ActualBalance"])); //add the diff of recieved coins
							});

						});
					}
				});
			}, this);
		});
	});

}

setInterval(Update, 30 * 1000); //every 30 sec
//FIXME:Round Down when upgrading balances
function GetNewAddress() {
	return new Promise(function (resolve, reject) {
		let daddress;
		shield.getNewAddress(function (err, address) {
			if (err) {
				reject(err);
				return;
			}
			this.validateaddress(address, function (err, info) {
				if (err) {
					reject(err);
					return;
				}
				daddress = address;
				resolve(daddress);

			})
		})
	})
}

function GetFromUID(uid) {
	return new Promise(function (resolve, reject) {
		db.find().make(function (filter) {
			filter.first();
			filter.where('uid', '=', uid);
			filter.callback(function (err, response) {
				if (err) {
					reject(err);
				} else {
					if(response === undefined){
						reject(0);
					}
					resolve(response);
				}
			});
		});
	});
}


function GetDepositAddress(uid) {
	return new Promise(function (resolve, reject) {
		GetFromUID(uid).then(x => {
			resolve(x["deposit_address"]);
		}).catch(err => {
			reject(err);
		});
	});
}

function UpdateBalance(uid, newBalance) {
	db.modify({
		balance: newBalance
	}).make(function (builder) {
		builder.first(); // --> modifies only one document
		builder.where('uid', uid);
		builder.callback(function (err, count) {
			console.log("update balance: " + uid + "; " + String(newBalance));
		});
	});
}

function GetBalance(uid) {
	return new Promise(function (resolve, reject) {
		GetFromUID(uid).then(x => {
			resolve(x["balance"]);
		}).catch(err => {
			reject(err);
		});
	});
}


//TODO: implement withdraw addresses
function WithdrawBalance(uid, address, amount) {
	return new Promise(function (resolve, reject) {
		GetBalance(uid).then(balance =>{
			if(balance > amount){
				amount -= 0.05; //Tx fee
				console.log("withdrawing",address,amount)
				shield.exec("sendToAddress", address, amount, function(err,txid){
					if(err){
						reject(err);
						return;
					}
					GetBalance(uid).then(balance => {
						GetBalance("MainAddr").then(Mainbalance => {		
							UpdateBalance(uid, balance - (amount + 0.05));
						});
					});
					resolve(txid);
				});
			}
		}).catch(err => {
			reject(err);
		})
	});
}

/* Returns deposit Addr or undefined*/
function AddNewUser(uid) {
	return new Promise(function (resolve, reject) {
		GetFromUID(uid).then(response => {
			resolve(response["deposit_address"]);
		}).catch(x => {
			GetNewAddress().then(Naddr => {
				db.insert({
					uid: uid,
					balance: 0,
					deposit_address: Naddr,
					ActualBalance: 0
				}).callback(function (err) {
					if (err) {
						reject(err);
						return;
					}
					resolve(Naddr);
				});
			}).catch(x => {
				reject(x);
			})
		})
	});
}

GetBalance("MainAddr").then(balance => {
	console.log("Main balance is:" + String(balance));
}).catch(x => {
	AddNewUser("MainAddr").then(x => {
		console.log("MainAddr address is: " + x);
	}).catch(x => {
		console.log("Couln't make address", err);
	});
	console.log(x);
});

function RandomNumber() { //dist
	return Math.random();
}

Client.on("ready", () => {
	//console.log( "ColorChange bot has been started!" );
	//Client.user.setGame( "SHIELDbot" );
	Client.user.setStatus("online");
	//var channel = Client.channels.get('general');
	//channel.sendMessage("Back online! again..");
});

var info_last = 0;

Client.on("message", Message => {
	if (Message.author.bot)
		return;

	if (Message.content.toLowerCase().startsWith("!info") && new Date().getTime() > info_last + (1000 * 60 * 1) && (Message.channel.type == "text")) { //wait five minutes interval at least
			//console.log(jsonf);
			var jsons = jsonf[0];
			Message.channel.sendMessage("XSH || " + jsons["price_btc"] + "BTC || $" + jsons["price_usd"] + " || " + jsons["percent_change_24h"] + "% || 24h Vol: $" +	jsons["24h_volume_usd"] + " || Rank: " + jsons["rank"] );
			info_last = new Date().getTime();
	}

	if (Message.content.toLowerCase().startsWith("!deposit") && (Message.channel.type == "text")) {
		GetFromUID(Message.author.id).then(user => {
			Message.channel.sendMessage("Your deposit address is:" + user["deposit_address"]);
		}).catch(err => {
			console.log(err);
			AddNewUser(Message.author.id).then(addr => {
				Message.channel.sendMessage("Your deposit address is: " + addr);
			});
		});
	}

	//TODO: custom amount
	if (Message.content.toLowerCase().startsWith("!chance") && (Message.channel.type == "text")) {
		GetBalance(Message.author.id).then(balance => {
			GetBalance("MainAddr").then(Mainbalance => {
				if (balance >= 50) {
					if (RandomNumber() > 0.51) {
						Message.channel.sendMessage("Chance! you win 50XSH");
						UpdateBalance(Message.author.id, balance + 50);
						UpdateBalance("MainAddr", Mainbalance - 50);
					} else {
						Message.channel.sendMessage("Bad luck! Try again next time!");
						UpdateBalance(Message.author.id, balance - 50);
						UpdateBalance("MainAddr", Mainbalance + 50);
					}
				} else {
					Message.channel.sendMessage("Not enough balance (50XSH needed)");
				}
			});
		}).catch(x =>{
			Message.channel.sendMessage("You haven't deposited any XSH yet (Hint: use `!deposit`)");
		});
	}

	if (Message.content.toLowerCase().startsWith("!balance")) {
		GetBalance(Message.author.id).then(x =>{
			Message.channel.sendMessage("You have: " + String(x) + "XSH");
		}).catch(x=>{
			Message.channel.sendMessage("You haven't deposited any XSH yet (Hint: use `!deposit`)");
		});
	}


	if(Message.content.toLowerCase().startsWith("!donate")){
		var amount = Number(Message.content.split(" ")[1]);
		if (amount == undefined || isNaN(amount)) {
			Message.channel.sendMessage("Use !donate <amount>");
			return;
		}
		if(amount < 1){
			Message.channel.sendMessage("Smart ass");
			return;
		}
		GetBalance(Message.author.id).then(balance => {
			GetBalance("MainAddr").then(Mainbalance => {

			UpdateBalance(Message.author.id, balance - amount);
			UpdateBalance("MainAddr", Mainbalance + amount);

				if (amount > 100000) {
					Message.channel.sendMessage("Thanks your the donation you can now choose a custom title");
					return;
				}else{
					Message.channel.sendMessage("Thanks for the donation.");
				}
			});
		}).catch(x =>{
			Message.channel.sendMessage("You haven't deposited any XSH yet (Hint: use `!deposit`)");
		});
	}

	if (Message.content.toLowerCase().startsWith("!withdraw")) {
		if (Message.content.split(" ").Length !== 3) {
			var amount = Number(Message.content.split(" ")[1]);
			var address = Message.content.split(" ")[2];

			if (amount == undefined || isNaN(amount)) {
				Message.channel.sendMessage("Use !withdraw <amount> <address>");
				return;
			}

			WithdrawBalance(Message.author.id, address, amount).then(x => {
				Message.channel.sendMessage("Succesfully withdrawed " + String(x));
			}).catch(x => {
				Message.channel.sendMessage("Failed to withdraw funds");
				console.log(x);
			});
		}
	}
	if (Message.content.toLowerCase().startsWith("!hashprofit")) {
		if (Message.content.split(" ").Length !== 3) {
			var amount = Number(Message.content.split(" ")[1]);
			var algo = Message.content.split(" ")[2].toLowerCase();

			if (amount == undefined || isNaN(amount)) {
				Message.channel.sendMessage("Use !hashprofit <hashrate in Mh> <algo>");
				return;
			}

			if(algos.indexOf(algo) < 0){
				Message.channel.sendMessage("Choose on of the algo's scrypt, groestl, lyra2re, blake");
				return;
			}

			shield.getinfo(function(err, response){
				if(err){
					console.log(err);
					Message.channel.sendMessage("Internal Server error");
					return;
				}
				var getinfo = response;
				XSHph = (1000000 * amount * 250 * 3600)/(getinfo["difficulty_" + algo] * 4294967296);//current block reward
				var jsons = jsonf[0];
				var pXSH = jsons["price_usd"];
				Message.channel.sendMessage("Estimated: " + String((XSHph).toFixed(2)) +" XSH/h || " + String((XSHph* 24).toFixed(2)) +" XSH/d || "+
															String((XSHph * pXSH).toFixed(2)) + " $/h || " +  String((XSHph * pXSH * 24).toFixed(2)) + " $/d");
				return;
			});
		}
	}

	if (Message.content.toLowerCase().startsWith("!help")) {
		Message.channel.sendMessage("!info shows the latest data on XSH\n" +
									"!deposit gets your deposit address\n" +
									"!withdraw <amount> <address> withdraws XSH\n" +
									"!donate <amount> donates XSH to the team\n"+
									"!balance shows you balance\n"+
									"!chance play's chance can win or lose 50XSH\n"+ 
									"!hashprofit <Hashrate in Mh> <algo> profit per algo/hashrate");
	}
});



Client.login("TOKEN");