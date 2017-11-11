//https://api.coinmarketcap.com/v1/ticker/shield-coin/

const Discord = require( "discord.js" );
const Client = new Discord.Client( );
const https = require('https');
var cmca = require('coinmarketcap-api');
var cmc = new cmca();

Client.on( "ready", ( ) => {
	//console.log( "ColorChange bot has been started!" );
	//Client.user.setGame( "SHIELDbot" );
	Client.user.setStatus("online");
	//var channel = Client.channels.get('general');
  	//channel.sendMessage("Back online! again..");
} );

var info_last = 0;

Client.on( "message", Message => {
	if( Message.author.bot )
		return;
    
    	if(Message.content.toLowerCase().startsWith("!info") && new Date().getTime() > info_last + (1000 * 60 * 1)){ //wait five minutes interval at least
		cmc.getTicker({limit: 1, currency: 'shield-xsh'}).then(jsonf => {
			console.log(jsonf);
			var jsons = jsonf[0];
			Message.channel.sendMessage("Change: " + jsons["percent_change_24h"] +"%\nVolume: " + jsons["24h_volume_usd"] + "$\nRank: " + jsons["rank"] + "\nPrice: " + jsons["price_usd"] + "$\n            " + jsons["price_btc"] + "BTC");
      			info_last = new Date().getTime();
		}).catch(console.error)
    	}
    
	/*if( Message.content.toLowerCase( ).startsWith( "$color" ) && ( Message.channel.type == "text" ) ) {
		let szArguments = Message.content.toLowerCase( ).split( " " ).slice( 1 );
		Message.delete( );
	
		if( szArguments.length < 1 ) {
			Message.channel.send( "Missing argument!" );
			Message.channel.send( "Example commad: $color #3399ff" );
			return;
		}
    }*/
} );

Client.login( "TOKEN" );
