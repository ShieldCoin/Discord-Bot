//https://api.coinmarketcap.com/v1/ticker/shield-coin/

const Discord = require( "discord.js" );
const Client = new Discord.Client( );
var http = require("http");

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
    
    if(Message.content.toLowerCase().startsWith("!info") && new Date().getTime() > info_last + (1000 * 60 * 5)){ //wait five minutes interval at least
        http.request({
            hostname: 'api.coinmarketcap.com',
            port: 80,
            path: '/v1/ticker/shield-coin/',
            method: 'GET',
            json:true
        }, function(error, response, body){
            if (error) console.log(error);
            else console.log(body);
            var jsons = JSON.parse(body);
            Message.channel.send("Volume: " + jsons["24h_volume_usd"] + "\nRank: " + jsons["rank"] + "\n Price: $" + jsons["price_usd"] + "/" + jsons["price_btc"] + "BTC");
            info_last = new Date().getTime();
	});
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
