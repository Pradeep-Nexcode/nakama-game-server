// ==================================================
// SIMPLE HOSTED MULTIPLAYER MATCH (LOBBY ONLY)
// Nakama = match creation + lobby + ready + start
// Gameplay handled by HOST CLIENT (Unity)
// ==================================================

var OpCode = {
  CHAT: 1,
  READY: 2,
  START: 3,
  LOBBY_STATE: 100,
  ERROR: 99,
};

// --------------------------------------------------
// SAFE JSON PARSE
// --------------------------------------------------
function parse(nk, msg) {
  try {
    if (!msg.data || msg.data.byteLength === 0) return null;
    var str = nk.binaryToString(msg.data);
    if (!str) return null;
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

// --------------------------------------------------
// MATCH INIT
// --------------------------------------------------
function matchInit(ctx, logger, nk, params) {

  var state = {
    players: {},        // sessionId -> player
    hostId: null,
    phase: "lobby"      // lobby | in_game
  };

  return {
    state: state,
    tickRate: 1, // VERY LOW (we don't simulate game)
    label: JSON.stringify({ mode:"player_hosted" })
  };
}

// --------------------------------------------------
// JOIN ATTEMPT
// --------------------------------------------------
function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence) {
  return { state: state, accept: true };
}

// --------------------------------------------------
// JOIN
// --------------------------------------------------
function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {

  for (var i=0;i<presences.length;i++) {

    var p = presences[i];

    // first player becomes host
    if (!state.hostId) {
      state.hostId = p.userId;
      logger.info("HOST = " + p.username);
    }

    state.players[p.sessionId] = {
      sessionId: p.sessionId,
      userId: p.userId,
      username: p.username,
      ready:false
    };
  }

  broadcastLobby(dispatcher, state, tick);
  return { state:state };
}

// --------------------------------------------------
// LEAVE
// --------------------------------------------------
function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {

  for (var i=0;i<presences.length;i++) {

    var p = presences[i];
    delete state.players[p.sessionId];

    // host migration
    if (p.userId === state.hostId) {

      var remaining = Object.values(state.players);

      if (remaining.length > 0)
        state.hostId = remaining[0].userId;
      else
        return null; // close match if empty
    }
  }

  broadcastLobby(dispatcher,state,tick);
  return { state:state };
}

// --------------------------------------------------
// LOOP (ONLY LOBBY EVENTS)
// --------------------------------------------------
function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {

  for (var i=0;i<messages.length;i++) {

    var msg = messages[i];
    var player = state.players[msg.sender.sessionId];
    if (!player) continue;

    switch(msg.opCode) {

      // ------------------------
      // READY TOGGLE
      // ------------------------
      case OpCode.READY:

        if (state.phase !== "lobby") break;

        player.ready = !player.ready;
        broadcastLobby(dispatcher,state,tick);
        break;

      // ------------------------
      // START GAME (HOST ONLY)
      // ------------------------
      case OpCode.START:

        if (player.userId !== state.hostId) {
          dispatcher.broadcastMessage(
            OpCode.ERROR,
            JSON.stringify({message:"Only host can start"}),
            [msg.sender]
          );
          break;
        }

        if (state.phase !== "lobby") break;

        var players = Object.values(state.players);

        if (players.length < 2) {
          dispatcher.broadcastMessage(
            OpCode.ERROR,
            JSON.stringify({message:"Need 2 players"}),
            [msg.sender]
          );
          break;
        }

        var allReady = players.every(p=>p.ready);

        if (!allReady) {
          dispatcher.broadcastMessage(
            OpCode.ERROR,
            JSON.stringify({message:"Players not ready"}),
            [msg.sender]
          );
          break;
        }

        // START MATCH
        state.phase = "in_game";

        dispatcher.broadcastMessage(
          OpCode.START,
          JSON.stringify({
            hostId: state.hostId,
            players: state.players
          })
        );

        break;

      // ------------------------
      // CHAT (OPTIONAL)
      // ------------------------
      case OpCode.CHAT:

        var data = parse(nk,msg);
        if (!data || !data.text) break;

        dispatcher.broadcastMessage(
          OpCode.CHAT,
          JSON.stringify({
            from:player.username,
            text:data.text
          })
        );

        break;
    }
  }

  return { state:state };
}

// --------------------------------------------------
// BROADCAST LOBBY STATE
// --------------------------------------------------
function broadcastLobby(dispatcher,state,tick){

  dispatcher.broadcastMessage(
    OpCode.LOBBY_STATE,
    JSON.stringify({
      phase: state.phase,
      hostId: state.hostId,
      players: state.players,
      tick:tick
    })
  );
}

// --------------------------------------------------
// TERMINATE
// --------------------------------------------------
function matchTerminate(ctx, logger, nk, dispatcher, tick, state) {
  return { state:state };
}

function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) {
  return { state:state, data:data };
}

// --------------------------------------------------
// RPC CREATE MATCH
// --------------------------------------------------
function rpcCreateMatch(ctx, logger, nk, payload){

  var matchId = nk.matchCreate("game_match",{});
  return JSON.stringify({ matchId:matchId });
}

// --------------------------------------------------
// REGISTER
// --------------------------------------------------
function InitModule(ctx, logger, nk, initializer){

  initializer.registerMatch("game_match",{
    matchInit:matchInit,
    matchJoinAttempt:matchJoinAttempt,
    matchJoin:matchJoin,
    matchLeave:matchLeave,
    matchLoop:matchLoop,
    matchTerminate:matchTerminate,
    matchSignal:matchSignal
  });

  initializer.registerRpc("create_match",rpcCreateMatch);

  logger.info("Simple Host Lobby Loaded");
}

globalThis.InitModule = InitModule;
