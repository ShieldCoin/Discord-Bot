const Discord = require( "discord.js" );
const Client = new Discord.Client( );

Client.on( "ready", ( ) => {
	console.log( "ColorChange bot has been started!" );
	Client.user.setGame( "SHIELDbot" );
} );

Client.on( "message", Message => {
	if( Message.author.bot )
		return;
		
	if( Message.content.toLowerCase( ).startsWith( "$color" ) && ( Message.channel.type == "text" ) ) {
		let szArguments = Message.content.toLowerCase( ).split( " " ).slice( 1 );
		Message.delete( );
	
		if( szArguments.length < 1 ) {
			Message.channel.send( "Missing argument!" );
			Message.channel.send( "Example commad: $color #3399ff" );
			return;
		}
	}
} );

Client.login( "TOKEN_HERE" );