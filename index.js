const Syslog = require('simple-syslog-server');
const PropertiesReader = require('properties-reader');
const winston = require('winston');
const fs = require('fs');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.prettyPrint(),
    defaultMeta: { service: 'user-service' },
    transports: [
        new winston.transports.File({ filename: 'syslog-server.log'}),
        new winston.transports.Console()
    ],
});

const prop = PropertiesReader('syslog-server.properties')

const socketType = prop.get('syslog.socketType');
const address = prop.get('syslog.address') ;
const port = prop.get('syslog.port') ;
var server;

switch(socketType){
    case 'TCP':
    case 'UDP':
        server = Syslog(socketType);
        break;
    case 'TLS':
        const tls_options = {
            key: fs.readFileSync(prop.get('syslog.tls.privateKey')).toString(),
            cert: fs.readFileSync(prop.get('syslog.tls.certificate')).toString(),
            ca: [fs.readFileSync(prop.get('syslog.tls.ca')).toString()]
        } ;
        server = Syslog.TLS(tls_options);
        break;
    default:
        throw 'Invalid socket type '+socketType;
}
 
var listening = false ;
var clients = [] ;
var count = 0 ;
 
server.on('msg', data => {
    console.info('message received (%i) from %s:%i\n%o\n', ++count, data.address, data.port, data) ;
})
.on('invalid', err => {
    console.warn('Invalid message format received: %o\n', err) ;
})
.on('error', err => {
    console.warn('Client disconnected abruptly: %o\n', err) ;
})
.on('connection', s => {
    let addr = s.address().address ;
    console.info(`Client connected: ${addr}\n`) ;
    clients.push(s) ;
    s.on('data', (buff) => {
        console.info(`data: ${buff.toString()}`);
    })
    s.on('end', () => {
        console.info(`Client disconnected: ${addr}\n`) ;
        let i = clients.indexOf(s) ;
        if(i !== -1)
            clients.splice(i, 1) ;
    }) ;
})
.listen({host: address, port: port})
.then(() => {
    listening = true ;
    console.info(socketType + ` now listening on: ${address}:${port}`) ;
})
.catch(err => {
    if ((err.code == 'EACCES') && (port < 1024)) {
        console.error('Cannot listen on ports below 1024 without root permissions. Select a higher port number: %o', err) ;
    }
    else { // Some other error so attempt to close server socket
        console.error(`Error listening to ${address}:${port} - %o`, err) ;
        try {
            if(listening)
                server.close() ;
        }
        catch (err) {
            console.warn(`Error trying to close server socket ${address}:${port} - %o`, err) ;
        }
    }
}) ;
