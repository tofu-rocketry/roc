// @ts-check
import chalk from 'chalk';
import { Client } from '@stomp/stompjs';
import { TCPWrapper } from '@stomp/tcp-wrapper';
import GameStompClient from './model/gameStompClient.js';
/** @typedef {import("./phonemanager.js").default} PhoneManager */
/** @typedef {import("./ROCManager.js").default} ROCManager */

export default class STOMPManager {
  /** @type {ROCManager} */
  gameManager;
  /** @type {PhoneManager} */
  phoneManager;
  /** @type {GameStompClient[]} */
  clients = []

  constructor() {
    this.clients = [];
  }

  /**
   * 
   * @param {ROCManager} gameManager 
   */
  setGameManager(gameManager) {
    this.gameManager = gameManager;
  }

  createClientForGame(game) {
    if ("interfaceGateway" in game) {
      if (!("host" in game) || !("port" in game.interfaceGateway)) {
        console.error(chalk.yellow('createClientForSim'), chalk.red("Invalid Interface Gateway configuration for", game.id));
        return false;
      }

      const client = new Client({
        webSocketFactory: () => new TCPWrapper(game.host, game.interfaceGateway.port),
        onConnect: (iFrame) => {
          console.log("STOMP Connect");
          console.log(iFrame);
          game.interfaceGateway.connected = true;
          this.gameManager.updateAdminUI();
          client.subscribe('/topic/SimSig', (message) => {
            const clockMessage = JSON.parse(message.body);
            if (clockMessage) {
              if ("clock_msg" in clockMessage) {
                this.gameManager.updateSimTime(clockMessage["clock_msg"]);
              }
            }
          });
          client.subscribe('/topic/TRAIN_MVT_ALL_TOC', (rawMessage) => {
            const message = JSON.parse(rawMessage.body);
            if(message.train_location) {
              console.log(`TRAIN_MVT_ALL_TOC:`, message)
            } else {
              //console.log('Ignoring train delay message');
            }
          }
          );
        },
        onStompError: (frame) => {
          console.log("STOMP StompError", frame);
        },
        onWebSocketError: (event) => {
          console.log("STOMP WebSocketError", event);
          game.interfaceGateway.connected = false;
          this.gameManager.updateAdminUI()
        },
      });
      // client.debug = function (str) {
      //   console.log(str);
      // };

      console.info(chalk.yellow('createClientForGame'), chalk.white("Created Interface Gateway configuration for", game.host));
      if (game.interfaceGateway.enabled === true) {
        client.activate();
        console.info(chalk.yellow('createClientForGame'), game.host, chalk.white("Interface Gateway"), chalk.green('ACTIVATED'));
      } else {
        console.info(chalk.yellow('createClientForGame'), game.host, chalk.white("Interface Gateway"), chalk.red('DISABLED'));
      }

      this.clients.push(new GameStompClient(game.sim, game, client));

    } else {
      console.info(chalk.yellow('createClientForGame'), chalk.red("No Interface Gateway configuration for", game.host));
    }
  }

  activateClientForGame(simId) {
    const gameClient = this.clients.find(c => c.id === simId)
    if (gameClient) {
      gameClient.client.activate();
      gameClient.game.interfaceGateway.enabled = true;
      return true;
    }
    return false;
  }

  deactivateClientForGame(simId) {
    const gameClient = this.clients.find(c => c.id === simId)
    if (gameClient) {
      gameClient.client.deactivate();
      gameClient.game.interfaceGateway.enabled = false;
    }
  }
}