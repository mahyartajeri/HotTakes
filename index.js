const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const {
    Server
} = require("socket.io");
const io = new Server(server);

const moment = require('moment-timezone');
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const {
    readFileSync,
    promises: fsPromises
} = require('fs');

let users = [];
let topics = [];
let rooms = [];

function syncReadFile(filename) {
    const contents = readFileSync(filename, 'utf-8');

    const arr = contents.split(/\r?\n/);

    console.log(arr);

    return arr;
}

topics = syncReadFile('./topics.txt');


app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html', console.log(__dirname + "/index.html"));
});

io.on('connection', (socket) => {

    let roomNum;
    // Existing room to join
    if (firstAvailableroom() < 0) {
        roomNum = newRoom();
        socket.join(roomNum);
        console.log(joinUser(socket.id, roomNum));
    } else {
        roomNum = firstAvailableroom();
        socket.join(roomNum);
        console.log(joinUser(socket.id, roomNum));
    }
    // Give topic to user
    io.to(roomNum).emit('new topic', getRoomTopic(getRoomNumber(socket.id)));

    socket.on('new topic', () => {
        // Leave current room
        socket.leave(getRoomNumber(socket.id));

        // Destroy room if last person in it skips it
        if (roomSize(getRoomNumber(socket.id)) < 2) {
            removeRoom(getRoomNumber(socket.id))
        }

        blackList(socket.id, getRoomNumber(socket.id));
        let newRoomNumber = getSkipRoom(socket.id);
        socket.join(newRoomNumber);
        setRoomNumber(socket.id, newRoomNumber);
        console.log("SKIPPED! Users: ", users);
        if (roomSize(getRoomNumber(socket.id)) > 1) {
            io.to(getRoomNumber(socket.id)).emit('new topic', getRoomTopic(getRoomNumber(socket.id)));
        } else {
            io.to(getRoomNumber(socket.id)).emit('new topic', topics[Math.floor(Math.random() * topics.length)]);
        }
    });

    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
        // Destory room if last person leaves
        if (roomSize(getRoomNumber(socket.id)) < 2) {
            //console.log(socket.id, "'s ROOM NUMBAH: ", getRoomNumber(socket.id))
            //console.log("AT THE TIME OF REMOVING ROOM: ", users);
            console.log(removeRoom(getRoomNumber(socket.id)));
        }
        console.log(removeUser(socket.id));
    });
    socket.on('chat message', (msg) => {
        console.log('message: ' + msg);
    });
    socket.on('chat message', (msg) => {
        var currentTime = moment().tz(timezone).format('HH:mm');
        io.to(socket.id).emit('chat message', {
            timeStamp: currentTime,
            sender: "You",
            message: msg
        });
        socket.broadcast.to(getOpponentId(socket.id)).emit('chat message', {
            timeStamp: currentTime,
            sender: "Opponent",
            message: msg
        });
    });

    console.log("ALL USERS: ", users);
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});

function joinUser(socketID, roomNumber) {
    const user = {
        id: socketID,
        roomNum: roomNumber,
        skip: -1,
    }
    users.push(user);
    return user;
}

function removeUser(id) {
    const getID = users => users.id === id;
    const index = users.findIndex(getID);
    if (index !== -1) return users.splice(index, 1)[0];
}

function newRoom() {
    let roomNum;
    if (rooms.length > 0) {
        let missing = false;
        for (let i = 0; i < rooms.length; i++) {
            // See if there is a room number ahead of its intended position
            if (rooms[i].n > i) {
                missing = true;
                roomNum = i;
                rooms.splice(i, 0, {
                    n: roomNum,
                    topic: topics[Math.floor(Math.random() * topics.length)]
                });
                break;
            }
        }
        if (!missing) {
            roomNum = rooms.length;
            rooms.push({
                n: roomNum,
                topic: topics[Math.floor(Math.random() * topics.length)]
            });
        }
    } else {
        roomNum = 0;
        rooms.push({
            n: roomNum,
            topic: topics[Math.floor(Math.random() * topics.length)]
        });
    }
    return roomNum;
}

function removeRoom(roomNum) {
    for (let i = 0; i < rooms.length; i++) {
        if (rooms[i].n == roomNum) return rooms.splice(i, 1);
    }
}

function getRoomNumber(id) {
    const usr = users.find(u => u.id === id);
    //console.log("getroomnum user is::::, ", usr);
    return usr.roomNum;
}

function setRoomNumber(id, roomNum) {
    const usr = users.find(u => u.id === id);
    //console.log("getroomnum user is::::, ", usr);
    usr.roomNum = roomNum;
}

function getRoomTopic(n) {
    const room = rooms.find(r => r.n === n);
    return room.topic;
}

function roomSize(roomNum) {
    let counter = 0;
    for (let i = 0; i < users.length; i++) {
        if (users[i].roomNum === roomNum) {
            counter++;
            //console.log("SWAGOOOOOOO");
        }
    }

    return counter;
}

function firstAvailableroom(skip = -1) {
    for (let i = 0; i < rooms.length; i++) {
        if (roomSize(rooms[i].n) < 2) return rooms[i].n;
    }

    return -1;
}

function blackList(id, skip) {
    const usr = users.find(u => u.id === id);
    //console.log("getroomnum user is::::, ", usr);
    usr.skip = skip;
}

function getSkipRoom(id) {
    // If another room is available, join that room
    if (firstAvailableroom() >= 0) {
        return firstAvailableroom();
    }
    // Otherwise create a new room
    else {
        return newRoom();
    }
}

function getOpponentId(id) {
    const n = users.find(u => u.id === id).roomNum;
    const usr2 = users.find(u => u.id !== id && u.roomNum === n);

    if (usr2) return usr2.id;
    else return "NOPE";
}