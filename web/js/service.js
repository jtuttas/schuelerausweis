function underage(dateString) {
    var d = new Date();
    d.setFullYear(d.getFullYear()-18);
    d.setHours(0,0,0);
    //console.log('Date:'+d);
    if (d>new Date(dateString)) {
        //console.log('Volljährig');
        return false;
    }
    //console.log('Minderjährig');
    return true;
}

function expired(dateString) {
    if (new Date(dateString)>new Date()) {
        //console.log("valid");
        return false;
    }
    //console.log("expired");
    return true;
}

