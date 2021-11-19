import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import { useContext, useState, useEffect } from 'react'
import { SocketContext } from '../services/socket';
import { userSetChanged, connectRoom } from '../services/roomService';
import {
  timerEvent,
  stateChangeEvent,
  startGame,
  emitAnswer,
  emitNextCategory,
  emitVote,
} from '../services/gameService';
import GameSettings from './GameSettings';
import PlayerList from './PlayerList';
import Round from './Round';
import { generateLetters } from './Letters';
import { generateCategories } from './Categories';
import { putObject, removeObject, fetchObject, keys } from '../services/cache';
import PostRound from './PostRound';
import Voting from './Voting';

const Room = ({ userName, roomName }) => {
  const socket = useContext(SocketContext);

  const [users, setUsers] = useState([]);
  const [room, setRoom] = useState(roomName);
  useEffect(() => {
    if (userName && roomName)
      connectRoom(socket, { userName, roomName });
  }, [socket, userName, roomName]);

  const [timer, setTimer] = useState('');
  const gameStates = {
    inLobby: "inLobby",
    inRound: "inRound",
    inVoting: "inVoting",
    inPostRound: "inPostRound"
  }
  const [gameState, setGameState] = useState({
    state: gameStates.inLobby,
    currentRound: 0,
  });
  const [answers, setAnswers] = useState([]);

  const defaultGameSettings = {
    numOfRounds: 3,
    lengthOfRound: 120,
    multiScoring: true,
    numOfCategories: 12,
    letters: generateLetters(),
    letterRotation: false,
    toggleAllCategories: true,
  }
  const [gameSettings, setSettings] = useState(defaultGameSettings);

  const [categories, setStateCategories] = useState({
    defaultCategories: generateCategories(true),
    customCategories: [],
  })
  const setGameSettings = (settings) => {
    setSettings(settings);
    putObject(keys.gameSettings, settings);
  }
  const setCategories = (categories) => {
    setStateCategories(categories);
    putObject(keys.categories, categories);
  }

  useEffect(() => {
    const loadCache = () => {
      const settings = fetchObject(keys.gameSettings);
      if (settings) {
        setGameSettings({ ...settings });
      }
      const ctgs = fetchObject(keys.categories);
      if (ctgs) {
        setStateCategories({ ...ctgs });
      }
    }

    loadCache();
  }, []);

  useEffect(() => {
    let mounted = true;
    const setUserChangeSocket = () => {
      socket.on(userSetChanged, (payload) => {
        if (mounted) {
          const { users, room, gameState } = payload;
          setUsers(users ? users : []);
          setRoom(room ? room : '');
          setGameState(gameState);
        }
      });
    }

    const setGameTimer = () => {
      socket.on(timerEvent,
        (seconds) => {
          if (mounted)
            setTimer(secondsToMinutes(seconds));
        });
    }

    const setGameStateListener = () => {
      socket.on(stateChangeEvent,
        (payload) => {
          if (mounted) {
            if (payload.state !== gameStates.inRound) {
              setAnswers([]);
            }
            setGameState(payload);
          }
        });
    }

    setUserChangeSocket();
    setGameTimer();
    setGameStateListener();
    return () => {
      mounted = false;
    }
  }, [
    socket,
    answers,
    gameStates.inLobby,
    gameStates.inRound,
    gameStates.inPostRound,
    gameStates.inVoting,
  ]);

  const resetGameSettings = () => {
    setGameSettings(defaultGameSettings);
    setCategories({
      defaultCategories: generateCategories(true),
      customCategories: [],
    });
  }

  const gameSettingsParams = {
    gameSettings,
    setGameSettings,
    categories,
    setCategories,
    resetGameSettings,
  }

  const secondsToMinutes = (seconds) => {
    let sec = parseInt(seconds);
    let dateTime = new Date(null);
    dateTime.setSeconds(sec);
    return dateTime.toISOString().substr(15, 4);
  }

  const setGameStart = () => {
    removeObject(keys.ratings);
    startGame(socket, {
      userName,
      roomName,
      gameSettings,
      categories
    });
  }

  const saveAnswer = (index, value) => {
    const ans = answers.length === 0 ? gameState.categories[gameState.currentRound] : answers;
    ans[index].answer = value;
    emitAnswer(socket, { roomName, index, value });
    setAnswers(ans);
  }

  const vote = (answID, value) => {
    console.log(`id: ${JSON.stringify(answID)}  value: ${value}`);
    emitVote(socket, {answID, vote: value});
  }

  const nextCategory = () => {
    emitNextCategory(socket, { roomName });
  }

  const renderGameState = (state) => {
    switch (state) {
      case gameStates.inLobby:
        return <GameSettings {...gameSettingsParams}></GameSettings>;
      case gameStates.inRound:
        return <Round
          timer={timer}
          gameState={gameState}
          saveAnswer={saveAnswer}>
        </Round>
      case gameStates.inVoting:
        return <Voting
          gameState={gameState}
          nextCategory={nextCategory}
          vote={vote}>
        </Voting>
      case gameStates.postRound:
        return <PostRound></PostRound>
      default:
        return <GameSettings {...gameSettingsParams}></GameSettings>;
    }
  }

  return (
    <Grid container component="main" sx={{ height: '100vh' }} >
      <Grid item xs={12} sm={12} md={8}
        sx={{ maxHeight: '100vh', overflow: 'auto' }}>
        {renderGameState(gameState.state)}
        {gameState.state === gameStates.inLobby && <Button variant="contained" size="large" color="success"
          onClick={() => setGameStart()}
          sx={{
            marginLeft: '40%',
            marginRight: '40%',
            height: '50px',
          }}>
          Start Game!
        </Button>}
      </Grid>
      <PlayerList users={users} roomName={room}></PlayerList>
    </Grid>
  );
}

export default Room;