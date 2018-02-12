
const eventHandlers = [
    require('./handlers/codepipeline')
];

exports.handler = (event, context, callback) => {

    const handler = eventHandlers.find(h => h.handles(event));
    if (handler) {
        callback(handler.handle(event));
    }
    else {
        console.log('No handler for: ' + JSON.stringify(event, null, 2));
    }

};

