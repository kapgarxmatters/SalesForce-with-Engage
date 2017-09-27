# SalesForce Service
Transform customer relationships, and your business, using the latest in mobile and data technology to deliver the most personalized customer experience ever — every time, and anywhere. This document instructs how to setup an integration between xMatters and SalesForce Case Management.  When a case is created, SalesForce reaches into xMatters to figure out who is on call for assignment of the case.  The Engage button in the case allows users to invite additional on call engineers to a call for further collaboration.  The Engage button can also be used to send out updates to various groups or xMatters subscriptions.

# Pre-Requisites
* SalesForce Case Module
* SalesForce Custome Object - Engage
* xMatters account - If you don't have one, [get one](https://www.xmatters.com)!

# Files
* [xMattersAlert.tgr](xMattersAlert.tgr) - The trigger used after a Case is initially submitted.  It sets the tokens/fields of the case that will be passed into xMatters and calls the xMatters request function.
* [xMattersreq.cls](xMattersreq.cls) - This is the Apex class that executes the Restful Post call into xMatters.
* [SalesForce-Outbound-Response_IB.js](SalesForce-Outbound-Response_IB.js) - Updates the Assigned user in the Salesforce Case when an xMatters user selects 'Assign to me' *NOTE: User must be have an active license in both xMatters & Salesforce
* [SalesForce-Inbound_IB.js](SalesForce-Inbound_IB.js) - This recieves the SalesForce payload from the SalesForce Apex Trigger transforms the content (if needed) to be formated for the xMatter New Case Form and creates a new xMatters event. 
* [SalesForce-Outbound-Delivery_IB.js](SalesForce-Outbound-Delivery_IB.js) - Sends a message back into Salesforce with record of recipient and device
* [Salesforce.zip](Salesforce.zip) - The comm plan (if needed) that has all the cool scripts and email format and such. 

# How it works
When a new SalesForce Case is submitted, SalesForce pushes the information into xMatters.  xMatters kicks off an event and sends the SalesForce case information to the engineer on call.  That engineer has the ability to respond in the xMatters notification.  By accepting the assignment in the xMatters notification, this updates the SalesForce Assignment field.  

After slecting the Engage button in a Case, the user will be presented with the options of who to invite and the type of way to engage (Conference Call or Update).  After submitting the Engage form, xMatters kicks off an event and sends the SalesForce information to the engineers on call in the groups selected.

# Installation

## SalesForce Setup
1. Log into Salesforce as a Salesforce Administrator, Create a new 'Connected App' for OAuth. (Learn more about setting up your Connected App [HERE](https://help.salesforce.com/articleView?id=connected_app_create.htm&type=0)).
* Setup > 'Quick Find / Search..' box (left side of the screen) > Create > Apps .  Once created, note the Consumer Key (Client ID) and Click to reveal Consumer Secret (Client Secret).
<kbd>
<img src="media/createconnectedappforoauth.png">
</kbd>

2. Log into Salesforce and create a xMatters user.  This user will be used to authenticate to make Restfual API calls for updates to Notes and Assignment field.  Once this user is created set a personal token.  At the top navigation bar go to your name > Setup > Personal Setup > My Personal Information > Reset My Security Token.

<kbd>
<img src="media/personalinfo.png">
</kbd>

<kbd>
<img src="media/resetsecuritytoken.png">
</kbd>

3. Using the SFDC Developer Console, Create Apex Trigger to reach out to xMatters. You can use this code to build the message that will be sent to xMatters.  *NOTE: String Endpoint will need to be changed to the Integration URL of your Inbound Configuration in the xMatters Integration Builder:

```
trigger xMattersAlert on Case (after insert) {
String endpoint = 'https://[xmatters instance]/api/integration/1/functions/19c22b53-b1e0-46e7-94ed-8c8d0ad704d2/triggers';
String caseid = '"Case ID":' + '"' + Trigger.New[0].CaseNumber + '"';
string description = '"Description":' + '"' + Trigger.New[0].Description + '"';
string priority = '"Priority":' + '"' + Trigger.New[0].Priority + '"';
string status = '"Status":' + '"' + Trigger.New[0].Status + '"';
string accountid = Trigger.New[0].AccountID;
string accountidj = '"Account ID":' + '"' + Trigger.New[0].AccountID + '"';
string recordid = '"ID":' + '"' + Trigger.New[0].Id + '"';

Account record = [Select Name From Account Where Id = :accountid];

string accountname = '"Account Name":' + '"' + record.Name + '"';
String payload = '{' + recordid + ',' + caseid + ',' + description + ',' + priority + ',' + accountname + ',' + accountidj + ',' + status + '}';
System.debug(accountid);
System.Debug(payload);

xmattersreq.xRESTCall(endpoint, payload);

}
```
3. In the Salesforce Developer Console, Create an Apex Class for your xMatters Request

```
global class xMattersreq {
@future(callout=true)
WebService static void xRESTCall(String endpoint, String payload){
HttpRequest req = new HttpRequest();
req.setEndpoint(endpoint);
req.setMethod('POST');

req.setBody(payload);
req.setHeader( 'Content-Type', 'application/json' );

Http http = new Http();
HTTPResponse res = http.send(req);
System.debug(' Response: ' + res.getBody());
}
}
```
 4. In SalesForce, in the Setup Navigation select Create -> Objects.  Create a New Object and label it Engage.  Fill out the other information required for the object and save it.
 
 <kbd>
<img src="media/engageobject.png">
</kbd>

5. Add the detail to the Engage Object: 
 1) Custom fields: 
   a) Account_Name
   b) CaseID
   c) Collaboration - Values
      1) Conf Call
      2) Update
      3) Slack (Setup of this functionality is not described in this documentation.)
   d) Comments
   e) Recipients - Values
      1) List of Groups that match xMatters Groups.
      
<kbd>
<img src="media/engageobjectdetail1.png">
</kbd>

2) Triggers - Create a trigger and call it xMattersEngage.  Copy the following code.  The second line references a Webhook that has not been created yet.  You will update this line in step 7 of the xMatters Setup instructions.

```
trigger xMattersEngage on Engage__c (after insert) {
    String endpoint = 'https://advisors.na5.xmatters.com/api/integration/1/functions/225fcbe0-f0b5-4e74-bdbd-0368fc03cdaf/triggers?apiKey=d742ef03-dc72-419c-acef-62d76da27750';
    String caseid = '"Case ID":' + '"' + Trigger.New[0].CaseID__c + '"';
    String comment = '"Comment":' + '"' + Trigger.New[0].Comments__c + '"';
    string accountname = '"Account Name":' + '"' + Trigger.New[0].Account_Name__c + '"';
    string engagetype = '"Type":' + '"' + Trigger.New[0].Collaboration__c + '"';
    string recipients = '"recipients":' + '"' + Trigger.New[0].Recipients__c + '"';
    System.debug(caseid);
    
    //c = [SELECT Id FROM Case WHERE Id =: '{!Case.Id}'];
     Case record = [Select CaseNumber From Case Where Id =: Trigger.New[0].CaseID__c];
    string casenumber = '"Case Number":' + '"' + record.CaseNumber + '"';
    String payload = '{' + caseid + ',' + comment + ',' + accountname + ',' + casenumber + ',' + engagetype + ',' + recipients + '}';
    System.Debug(payload);
    
    xmattersreq.xRESTCall(endpoint, payload);
    
}
```

<kbd>
<img src="media/xMattersEngageTrigger.png">
</kbd>

3) Page Layouts - Create a simple layout that uses the custom fields and the submit buttion.
<kbd>
<img src="media/engagelayout1.png">
</kbd>
<kbd>
<img src="media/engagelayout2.png">
</kbd>

4) Buttons - Create a Submit button with the following properties.  Copy the following code into the JavaScript editor.

<kbd>
<img src="media/engagesubmitbutton.png">
</kbd>

```
{!REQUIRESCRIPT ("/soap/ajax/13.0/connection.js")};
{!REQUIRESCRIPT("/soap/ajax/30.0/apex.js")};

caseid = '"Case ID":' + '"' + "{!Case.CaseNumber}" + '"';
contact = '"Contact":' + '"' + "{!Case.Contact}" + '"';
subject = '"Subject":' + '"' + "{!Case.Subject}" + '"';
priority = '"Priority":' + '"' + "{!Case.Priority}" + '"';
status = '"Status":' + '"' + "{!Case.Status}" + '"';
accountid = '"Account ID":' + '"' + "{!Case.AccountId}" + '"';
recordid = '"ID":' + '"' + "{!Case.Id}" + '"';
accountname = '"Account Name":' + '"' + "{!Case.Account}" + '"';
description = '"Description":' + '"' + "{!Case.Description}" + '"';
payload = '{' + contact + ',' + subject + ',' + recordid + ',' + caseid + ',' + description + ',' + priority + ',' + accountname + ',' + accountid + ',' + status + '}';

endpoint = 'https://salesdemo.cs1.xmatters.com/api/integration/1/functions/dbda74c0-69db-4715-bb77-1fde1fa60c29/triggers';

sforce.apex.execute("xMattersreq","xRESTCall",{endpoint:endpoint, payload:payload});
```


## xMatters set up
1. Import the Salesforce Communication Plan (See Salesforce.zip in files above).  If you use the attached Salesforce Communication Plan you can skip steps 2-4.

2. Optional - Create an Inbound IB script using the following code or the code from the SalesForce-Inbound_IB.js file.
```
var data = JSON.parse(request.body);

var datan = '{' + '"properties":' + JSON.stringify(data) + '}';
var json = JSON.parse(datan);
console.log(JSON.stringify(json));

// Post trigger to form
form.post(json);
```

3. Optional - Create an Outbound IB Delivery script using the following code or the code from the SalesForce-Outbound-Delivery_IB.js file
```
var callback = JSON.parse(request.body);
console.log('Executing outbound integration for xMatters event ID: ' + callback.eventIdentifier);



// Convert list of event properties to an eventProperties object
if (callback.eventProperties && Array.isArray(callback.eventProperties)) {
    var eventProperties = callback.eventProperties;
    callback.eventProperties = {};

    for (var i = 0; i < eventProperties.length; i++) {
        var eventProperty = eventProperties[i];
        var key = Object.keys(eventProperty)[0];
        callback.eventProperties[key] = eventProperty[key];
    }
}

// Handle responses without annotations
if (callback.annotation == "null") {
    callback.annotation = null;
}

console.log("Request body -" + JSON.stringify(callback));

var ID      = callback.eventProperties['ID'];
console.log(ID);

console.log( 'Adding a note' );

payload = {
    "ParentId": ID,
    "CommentBody": 'Update from xMatters at - ' + callback.recipient + " contacted on " + callback.device
};

req = http.request({
  method: 'POST',
  endpoint: 'SalesForce',
  path: '/services/data/v22.0/sobjects/CaseComment' + '/',

});

resp = req.write( payload );
console.log(resp);
```

4. Optional - Create an Outbound IB Response script using the following code or the code from the SalesForce-Outbound-Response_IB.js file

```
var callback = JSON.parse(request.body);
console.log('Executing outbound integration for xMatters event ID: ' + callback.eventIdentifier);

// Convert list of event properties to an eventProperties object
if (callback.eventProperties && Array.isArray(callback.eventProperties)) {
    var eventProperties = callback.eventProperties;
    callback.eventProperties = {};

    for (var i = 0; i < eventProperties.length; i++) {
        var eventProperty = eventProperties[i];
        var key = Object.keys(eventProperty)[0];
        callback.eventProperties[key] = eventProperty[key];
    }
}
// Handle responses without annotations
if (callback.annotation == "null") {
    callback.annotation = null;
}



var ID      = callback.eventProperties['ID'];

var assigneeId = getUserId(callback.recipient );

var req = http.request({
  method: 'PATCH',
  endpoint: 'SalesForce',
  path: '/services/data/v22.0/sobjects/Case/' + ID,
});
var payload = JSON.stringify({
            "OwnerId": assigneeId
});
var resp = req.write( payload );
console.log( JSON.stringify( resp ) );



/***********************************************
 * getUserId
 * Get a user's unique Id from SF.
 ***********************************************/
function getUserId( userName ) {

    // We're using SOQL here
      var queryParms = "q=select%20Id,%20name,%20username%20from%20User%20where%20Alias='" + encodeURI( userName ) + "'";
    console.log(queryParms);

    var request = http.request({
        'endpoint': 'SalesForce',
        'method': 'GET',
        'path': '/services/data/v22.0/query/?' + queryParms,
    });

    console.log( 'Getting user "' + userName + '"' );

    var response = request.write();
    var userList = JSON.parse( response.body );

    if( userList.totalSize === 0 ){
        return null;
    }
    else
        return userList.records[0].Id;

}
```

5. In Integration Builder, Configure your Salesforce Endpoint  *NOTE: if you're using a relaxed IP policy, you'll need to add your API token to the end of your Password. For the following information see the SalesForce Setup steps above.
* At the top navigation bar in SalesForce go to your name > Setup > Personal Setup > My Personal Information > Reset My Security Token.
* If your password is mypassword, and your security token is XXXXXXXXXX, then you must enter mypasswordXXXXXXXXXX in the xMatters Endpoint to authenticate correctly.
* Client ID & Client Secret can be found by accessing the connected App in Salesforce.  Setup > 'Quick Find / Search..' box (left side of the screen) > Create > Apps > Find 'Connected Apps' and click on the app (this is the connected app we setup earlier, recommended name is xMatters).  Find Consumer Key (Client ID) and Click to reveal Consumer Secret (Client Secret).

<kbd>
<img src="media/xmattersendpoint.png">
</kbd>

6. Add Recipients/Groups to the xMatters New Case Layout.  Login to xMatters with Developer rights.  Click on the Developer tab.  In the SalesForce Communication Plan navigate to the New Case Form.

<kbd>
<img src="media/xmattersform.png">
</kbd>

* In the New Case Form naviagete to the Layout view and add Recipeients.

<kbd>
<img src="media/xmattersrecipients.png">
</kbd>

   
# Testing
1. The SalesForce Group is the default recipient in the xMatters New Case form.  Add yourself to the xMatters group.  Make sure this same user exists in SalesForce.
2. In SalesForce Create a new case.
3. Automatically, an event is created in xMatters with the SalesForce case  information.  The on call user in the xMatters SalesForce group is notified.  This is all logged back into SalesForce Case Comments.
4. Have the on call user respond with "Accept the Assignment" in the xMatters notification.
5. This updates SalesForce Assigned to Field and Case Comments.  If when you created the case in SalesForce it automatically assigned you the Assignment field you will not notice the update to the Assignment field.  Have a different user create the case then is on call to test out the functionality.  

# Troubleshooting
Check the SalesForce developer console logging and xMatters Activity streams for the Inbound and Outbound integrations.
