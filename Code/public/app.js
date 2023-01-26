const socket = io("http://localhost:3000");

function diagno(erreur) {
    console.log("###################");
    console.log(nbErreur);
    var nbErreur = erreur.length;
    if(nbErreur == 0) {
        document.querySelector("#histo").innerHTML = '<div>Aucune panne en cours !</div>';
    } else {
        var message = "<div>";
        let lienDocumentation = null;
        for(let i=0; i<nbErreur; i++) {
            switch(erreur[i]) {
                case "Problème de fonctionnement du module peltier":
                    lienDocumentation = "Pour corriger cette panne, consultez les documentations suivantes : <br>";
                    lienDocumentation += "- <a href = '/maintenance.html?doc=4'>Maintenance Curative - Gamme 1</a><br>";
                    lienDocumentation += "- <a href='/maintenance.html?doc=5'>Maintenance Curative - Gamme 2</a>";
                    message += "<span id='erreur'>"+erreur[i]+"</span><br>" + lienDocumentation + "<br> <br>";
                    break;
                case "Puissance consommée trop importante !":
                    lienDocumentation = "Pour corriger cette panne, consultez la documentation suivante : <br>";
                    lienDocumentation += "<a href = '/maintenance.html?doc=7'>Maintenance Curative - Gamme 9</a>";
                    message += "<span id='erreur'>"+erreur[i]+"</span><br>" + lienDocumentation + "<br> <br>";
                    break;
                default:
                    message += "<span id='erreur'>"+erreur[i] + "<br> <br>";
                    break;
            }
        }
        message += "</div>";
        document.querySelector("#histo").innerHTML = message;
    }
}

socket.on("STDS/2/Puissance", (arg) => {
    document.querySelector("#puissance").textContent = arg
    document.querySelector("#puissance2").textContent = arg
    document.getElementById("image").style.clipPath = "polygon(100% "+(100-(arg*100/80))+"%,100% 100%,0% 100%,0% "+(100-(arg*100/80))+"%)"
});

socket.on("STDS/2/CO2", (arg) => {
    document.querySelector("#co2").textContent = arg
    document.querySelector("#co22").textContent = arg
    diagno("Problème de fonctionnement du module peltier");
    //document.querySelector("#cardCo2").style.display = "none"
    //Pour cacher une card
});

socket.on("STDS/2/Température/T2", (arg) => {
    document.querySelector("#tint").textContent = arg
    gaugeInt.set(document.querySelector('#tint').textContent); // set current value
    document.querySelector("#tint2").textContent = arg
    if(arg<=7){
        document.querySelector("#pastilleTemp").style.color = "#00CC00";
    }else if(arg<=10){
        document.querySelector('#pastilleTemp').style.color = "#f9dc20";
    }else{
        document.querySelector("#pastilleTemp").style.color = "#FF0000";
    }


    if(arg<=-120){
        document.querySelector('#jaugeInt').style.display = "none";
        document.querySelector("#tint2").textContent = 'Déconnecté';
        document.querySelector("#pastilleTemp").style.color = "#AAAAAA";
    }else{
        document.querySelector('#jaugeInt').style.display = "block";
    }
});

socket.on("STDS/2/Température/T1", (arg) => {
    document.querySelector("#text").textContent = arg
    gaugeExt.set(document.querySelector('#text').textContent); // set current value
    document.querySelector('#jaugeExt')
    document.querySelector("#text2").textContent = arg
    if(arg<=-120){
        document.querySelector('#jaugeExt').style.display = "none";
        document.querySelector("#text2").textContent = 'Déconnecté';
    }else{
        document.querySelector('#jaugeExt').style.display = "block";
    }
});

socket.on("STDS/2/Niveau", (arg) => {
    document.querySelector("#quantite").textContent = arg
    document.querySelector("#quantite2").textContent = arg
});

socket.on("STDS/2/Diag", (arg) => {
    document.querySelector("#diag").textContent = arg
});

socket.on("Panne", (arg) => {
    diagno(arg);
});
