const socket = io("http://localhost:3000");

socket.on("hello", (arg) => {
    console.log(arg);
});