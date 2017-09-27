/*
Inbound integration used to engage additonal groups and send an update..
*/


var xmattersLibrary = require('xmatters_utility');
var slackLibrary = require('slack_utility');

var data = JSON.parse(request.body);

var datan = '{' + '"properties":' + JSON.stringify(data) + '}';
var json = JSON.parse(datan);
console.log(JSON.stringify(json));

arr = data.recipients.split(';');
var recipients = [];

for (var i = 0, len = arr.length; i < len; i++) {
  recipients.push({'targetName': arr[i]});  //Syntax to add a user
}
json.recipients = recipients;

var type = data.Type;
console.log("Collaboration Type:" + type);
if (type.toLowerCase() == "update"){
    path = '/reapi/2015-04-01/forms/2eb9b3e3-72f9-432d-9551-08e3c6e5256f/triggers';
    xmattersLibrary.xmattersEvent(path, json);
}
else if (type.toLowerCase() == "conference call"){
    path = '/reapi/2015-04-01/forms/69c391fe-b599-42df-8f3f-6813ac0d5c4c/triggers';
    xmattersLibrary.xmattersEvent(path, json);
}
