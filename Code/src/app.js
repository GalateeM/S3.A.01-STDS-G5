const socket = io("http://localhost:1234");

socket.on("hello", (arg) => {
    console.log(arg);
});