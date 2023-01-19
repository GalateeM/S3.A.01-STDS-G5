const socket = io("http://localhost:3000");

socket.on("STDS/2/Puissance", (arg) => {
    document.querySelector("#puissance").textContent = arg
});

socket.on("STDS/2/CO2", (arg) => {
    document.querySelector("#co2").textContent = arg
});

socket.on("STDS/2/Température/T1", (arg) => {
    document.querySelector("#tint").textContent = arg
});

socket.on("STDS/2/Température/T2", (arg) => {
    document.querySelector("#text").textContent = arg
});

socket.on("STDS/2/Niveau", (arg) => {
    document.querySelector("#quantite").textContent = arg
});
