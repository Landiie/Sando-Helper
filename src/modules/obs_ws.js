const OBSWebSocket = require("obs-websocket-js").default;
const fs = require("fs");
const process = require("process");
const dialog = require("./dialog.js");
const isEqual = require("lodash.isequal");
const utils = require("./utils.js");
const semver = require("semver");
const { app } = require("electron");
const path = require("path");

const obs = new OBSWebSocket();

const OBSPKG_VERSION = "1.0.0";

let obsHost = "127.0.0.1";
let obsPort = 4457;
let obsPw = "";
let obsVersion = null;


if (app.isPackaged) {
  obsHost = utils.getArgValue("--obsIp", process.argv);
  obsPort = utils.getArgValue("--obsPort", process.argv);
  obsPw = utils.getArgValue("--obsPw", process.argv);
}

module.exports = {
  async connect() {
    try {
      await obs.connect(`ws://${obsHost}:${obsPort}`, obsPw, {
        rpcVersion: 1,
      });
      const respVersion = await obs.call("GetVersion");
      obsVersion = respVersion.obsVersion;
      return true;
    } catch (e) {
      return e;
    }
  },
  async scenesPack(targetScene, denyList = [], outPath) {
    let parsedScenes = [];
    let parsedEmptyScenesCount = 0; //this is a bit silly but it helps let sammi know when scenes are done installing
    // let targetSceneParsed = false;
    let createdItems = [];
    let parsedSceneItemCount = 0;

    let scenes = [];
    try {
      console.log('scenes')
      scenes = await obsGetSceneList();
      console.log('scenes fetched ')

      //kickstart the chain
      console.log('first get scene items')
      const sceneItems = await getSceneItems(targetScene);
      console.log('first get scene items done')
      console.log('parse filters')
      const initialFilters = parseFilters(
        await obsGetSourceFilterList(targetScene)
      );
      console.log('parse filters done')
      const compiled = {
        packerVersion: OBSPKG_VERSION,
        sceneItems: sceneItems,
        targetScene: targetScene,
        targetSceneFilters: initialFilters,
        parsedSceneItemCount: parsedSceneItemCount,
        parsedScenesCount: parsedScenes.length,
        parsedEmptyScenesCount: parsedEmptyScenesCount,
      };
      console.log(compiled);

      console.log('write file')
      fs.writeFileSync(outPath, JSON.stringify(compiled), "utf-8");
      console.log('write file done')
      return outPath;
    } catch (e) {
      throw new Error(e);
    }

    async function getSceneItems(scene) {
      if (parsedScenes.includes(scene)) return "already parsed";
      if (!scenes.includes(scene)) return "not a scene";

      let parsedSceneItems = [];

      const sceneItems = await obsGetSceneItems(scene);

      if (sceneItems.length === 0) parsedEmptyScenesCount++; //todo will probably get revised! currently tries to operate on nothing

      for (let i = 0; i < sceneItems.length; i++) {
        const sceneItem = sceneItems[i];

        if (denyList.includes(sceneItem.sourceName)) continue;
        parsedSceneItemCount++;

        const parsedSceneItem = {
          name: sceneItem.sourceName,
        };

        if (sceneItem.inputKind === null) {
          sceneItem.inputKind = "scene";
        }

        if (sceneItem.inputKind !== "scene") {
          sceneItem.sourceSettings = await obsGetInputSettings(
            sceneItem.sourceName
          ); //the get scene items req is missing settings so i just slap it in here
          //an input
          parsedSceneItem.settings = JSON.stringify(sceneItem.sourceSettings);

          if (
            sceneItem.inputKind === "source-clone" &&
            sceneItem.sourceSettings.clone !== ""
          ) {
            const cloneName = sceneItem.sourceSettings.clone;
            parsedSceneItem.sceneItems = await getSceneItems(cloneName);
            parsedSceneItem.sceneName = cloneName;
            parsedSceneItem.cloneSceneFilters = parseFilters(
              await obsGetSourceFilterList(cloneName)
            );
          }

          //referenced source check
          if (createdItems.includes(sceneItem.sourceName)) {
            parsedSceneItem.isReference = true;
          } else {
            parsedSceneItem.isReference = false;
            createdItems.push(sceneItem.sourceName);
          }
        } else {
          //vanilla nested scene
          parsedSceneItem.settings = null;
          parsedSceneItem.sceneItems = await getSceneItems(
            sceneItem.sourceName
          );
          parsedSceneItem.sceneName = sceneItem.sourceName;
        }

        //* Filters
        parsedSceneItem.filters = parseFilters(
          await obsGetSourceFilterList(sceneItem.sourceName)
        );

        //* Scene Item Transformations
        parsedSceneItem.transformations = await obsGetSceneItemTransform(
          scene,
          sceneItem.sceneItemId
        );

        parsedSceneItem.blendType = await obsGetSceneItemBlendMode(
          scene,
          sceneItem.sceneItemId
        );

        parsedSceneItem.monitorType = await obsGetInputAudioMonitorType(
          sceneItem.sourceName
        );
        parsedSceneItem.type = sceneItem.inputKind;
        parsedSceneItem.visibility = `${await obsGetSceneItemEnabled(
          scene,
          sceneItem.sceneItemId
        )}`;
        parsedSceneItem.locked = `${await obsGetSceneItemLocked(
          scene,
          sceneItem.sceneItemId
        )}`;
        parsedSceneItem.volume = await obsGetInputVolume(sceneItem.sourceName);

        parsedSceneItems.push(parsedSceneItem);
      }

      parsedScenes.push(scene); //mark as parsed
      return parsedSceneItems;
    }

    function parseFilters(filterList) {
      let filters = [];
      if (filterList.length === 0) return filters;
      filterList.forEach(filter => {
        let filterObj = {
          type: filter.filterKind,
          name: filter.filterName,
          visibility: `${filter.filterEnabled}`, //converts bool to string, maintains the bool in sammi (stupid i know)
          settings: JSON.stringify(filter.filterSettings),
        };
        filters.push(filterObj);
      });
      return filters;
    }

    async function obsGetInputVolume(input) {
      try {
        const res = await obs.call("GetInputVolume", {
          inputName: input,
        });
        return res.inputVolumeDb;
      } catch (e) {
        return 1;
      }
    }

    async function obsGetInputAudioMonitorType(input) {
      try {
        const res = await obs.call("GetInputAudioMonitorType", {
          inputName: input,
        });
        return res.monitorType;
      } catch (e) {
        return "OBS_MONITORING_TYPE_NONE";
      }
    }

    async function obsGetSceneItemLocked(scene, sceneItemId) {
      const res = await obsCall("GetSceneItemLocked", {
        sceneName: scene,
        sceneItemId: sceneItemId,
      });
      return res.sceneItemLocked;
    }
    async function obsGetSceneItemEnabled(scene, sceneItemId) {
      const res = await obsCall("GetSceneItemEnabled", {
        sceneName: scene,
        sceneItemId: sceneItemId,
      });
      return res.sceneItemEnabled;
    }
    async function obsGetSceneItemBlendMode(scene, sceneItemId) {
      try {
        const res = await obsCall("GetSceneItemBlendMode", {
          sceneName: scene,
          sceneItemId: sceneItemId,
        });
        return res.sceneItemBlendMode;
      } catch (e) {
        return "UNKNOWN";
      }
    }

    async function obsGetSceneItemTransform(scene, sceneItemId) {
      const res = await obsCall("GetSceneItemTransform", {
        sceneName: scene,
        sceneItemId: sceneItemId,
      });
      const transform = res.sceneItemTransform;
      //do some fixins
      if (transform.boundsWidth === 0) transform.boundsWidth = 1;
      if (transform.boundsHeight === 0) transform.boundsHeight = 1;

      return transform;
    }

    async function obsGetSourceFilterList(source) {
      const res = await obsCall("GetSourceFilterList", {
        sourceName: source,
      });
      return res.filters;
    }

    async function obsGetInputSettings(input) {
      const res = await obsCall("GetInputSettings", {
        inputName: input,
      });
      return res.inputSettings;
    }

    async function obsGetSceneItems(scene) {
      const res = await obsCall("GetSceneItemList", {
        sceneName: scene,
      });
      return res.sceneItems;
    }

    async function obsGetSceneList() {
      const res = await obsCall("GetSceneList");
      const scenes = res.scenes.map(o => o.sceneName);
      return scenes;
    }

    async function obsCall(requestType, requestData = {}) {
      try {
        const res = await obs.call(requestType, requestData);
        return res;
      } catch (e) {
        throw new Error(e);
      }
    }
  },
  async scenesUnpack(obspkgPath) {
    // Parse spkg
    const obspkg = JSON.parse(fs.readFileSync(obspkgPath));

    // const sceneItemCountTarget = obspkg.parsedSceneItemCount;
    // const sceneCountTarget = obspkg.parsedScenesCount;
    // const sceneEmptyCountTarget = obspkg.parsedEmptyScenesCount;

    //Setup
    let offsets = {};
    let sceneItemCount = 0;
    let sceneCount = 0;
    let sceneEmptyCount = 0;
    const loadedScenes = {
      names: [],
      data: [],
      sourceNames: [],
    };

    // if (!obspkgPath) {
    //   console.error("no obspkg provided");
    //   process.exit(1);
    // }

    try {
      await currentSceneDataFill(); // fills loadedScenes obj

      //begin unpacking process via first call of recursion
      //this call is the only one that contains init filters.
      await createScene(
        obspkg.targetScene,
        obspkg.sceneItems,
        obspkg.targetSceneFilters
      );
    } catch (e) {
      dialog.showMsg({ type: "error", message: e.message, details: e.stack });
      console.log(e);
      return false;
    }

    return true;

    async function getSceneList() {
      const sceneList = await obs.call("GetSceneList");
      return sceneList.scenes;
    }

    async function getSceneItemList(sceneName) {
      const sceneItemList = await obs.call("GetSceneItemList", {
        sceneName: sceneName,
      });
      return sceneItemList.sceneItems;
    }

    async function currentSceneDataFill() {
      //get scene list, move around data
      const sceneList = await getSceneList();

      for (let i = 0; i < sceneList.length; i++) {
        const scene = sceneList[i];
        sceneName = scene.sceneName;
        loadedScenes.names.push(sceneName);
        const sceneItems = await getSceneItemList(sceneName);
        // console.log(sceneItems);
        for (let i2 = 0; i2 < sceneItems.length; i2++) {
          const source = sceneItems[i2];
          loadedScenes.sourceNames.push(source.sourceName);
        }
      }
    }

    async function createScene(targetScene, rawData, filters, cloneFilters) {
      if (!targetScene) {
        process.exit(1);
      }

      //create scene
      //but first, check if it already exists or not
      if (!(await sceneExists(targetScene))) {
        //could not find scene, proceed with creation
        await obs.call("CreateScene", { sceneName: targetScene });
      } else {
      }

      //if provided, add/overwrite any filters
      if (filters || cloneFilters) {
        let sceneFilters;
        // merge filters from standard or clone
        if (filters) {
          sceneFilters = filters;
        } else {
          sceneFilters = cloneFilters;
        }

        for (let i = 0; i < sceneFilters.length; i++) {
          const filter = sceneFilters[i];
          await addOrUpdateFilter(targetScene, filter);
        }
      } else {
      }

      sceneCount++;
      //scene done, parse it's items now
      const parsingResult = await parseSceneItems(targetScene, rawData);
      if (parsingResult === "end-unpacking") {
        // console.log("end of unpacking");
        return "end-unpacking";
      }
    }

    async function parseSceneItems(scene, sceneItems) {
      let scenesFound = 0;

      //if no items, it's an empty scene
      if (sceneItems.length === 0) {
        sceneEmptyCount++;
      }

      for (let i = 0; i < sceneItems.length; i++) {
        const item = sceneItems[i];
        let createStandardInput = true;
        sceneItemCount++;

        //quick check to see if this is the end of the package manager
        if (packagerEnd(item)) {
          return "end-unpacking";
          // process.exit(1);
        }

        let refCheck = false;
        if (item.type === "scene" || item.type === "source-clone") {
          if (item.type === "scene") {
            //scene
            if (item.sceneItems !== "already parsed") {
              scenesFound++;
              await createScene(
                item.sceneName,
                item.sceneItems,
                null,
                item.cloneSceneFilters
              );
            } else {
              //scene has already been parsed through before, just nest it
            }

            createStandardInput = false;
          } else {
            //clone
            if (Array.isArray(item.sceneItems)) {
              scenesFound++;
              await createScene(
                item.sceneName,
                item.sceneItems,
                null,
                item.cloneSceneFilters
              );
            } else {
              //is not a scene clone
            }
            refCheck = true;
          }
        } else {
          //not scene or clone, could be item or ref
          refCheck = true;
        }

        if (refCheck === true && item.isReference === true) {
          createStandardInput = false;
        }

        item.sceneName = scene;
        item.isStandardInput = createStandardInput;

        //console.log("creating input...", item);
        const sceneItemId = await createInput(item);

        //should have id now, if not, uh oh.
        if (!sceneItemId) console.log("you REALLY messed up!!");

        //set scene item transformations
        await setSceneItemTransformation(scene, sceneItemId, item);

        //parser end checker to see if install complete
        // if (
        //   sceneItemCount === sceneItemCountTarget &&
        //   sceneCount === sceneCountTarget &&
        //   sceneEmptyCountTarget == sceneEmptyCountTarget
        // ) {
        //   //everything installed
        //   console.log("TRULY DONE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        //   process.exit(1);
        // }
      }
    }

    async function setSceneItemTransformation(
      scene,
      sceneItemId,
      sceneItemData
    ) {
      await SetSceneItemTransformAndValidate(
        scene,
        sceneItemId,
        sceneItemData.transformations
      );
      await SetSceneItemLockedAndValidate(
        scene,
        sceneItemId,
        utils.stringToBool(sceneItemData.locked)
      );
      await SetSceneItemBlendModeAndValidate(
        scene,
        sceneItemId,
        sceneItemData.blendType
      );
      await SetSceneItemEnabledAndValidate(
        scene,
        sceneItemId,
        utils.stringToBool(sceneItemData.visibility)
      );
    }

    async function SetSceneItemEnabledAndValidate(scene, id, enabled) {
      let timeout = 0;
      while (true && timeout < 5) {
        //set new transform, then fetch those applied settings
        await obs.call("SetSceneItemEnabled", {
          sceneName: scene,
          sceneItemId: id,
          sceneItemEnabled: enabled,
          overlay: true,
        });

        const newEnabled = (
          await obs.call("GetSceneItemEnabled", {
            sceneItemId: id,
            sceneName: scene,
          })
        ).sceneItemEnabled;

        if (newEnabled === enabled) break;
        timeout++;
      }
    }

    async function SetSceneItemBlendModeAndValidate(scene, id, blendMode) {
      let timeout = 0;
      while (true && timeout < 5) {
        //set new transform, then fetch those applied settings
        await obs.call("SetSceneItemBlendMode", {
          sceneName: scene,
          sceneItemId: id,
          sceneItemBlendMode: blendMode,
          overlay: true,
        });

        const newBlendMode = (
          await obs.call("GetSceneItemBlendMode", {
            sceneItemId: id,
            sceneName: scene,
          })
        ).sceneItemBlendMode;

        if (newBlendMode === blendMode) break;
        timeout++;
      }
    }

    async function SetSceneItemBlendModeAndValidate(scene, id, blendMode) {
      let timeout = 0;
      while (true && timeout < 5) {
        //set new transform, then fetch those applied settings
        await obs.call("SetSceneItemBlendMode", {
          sceneName: scene,
          sceneItemId: id,
          sceneItemBlendMode: blendMode,
          overlay: true,
        });

        const newBlendMode = (
          await obs.call("GetSceneItemBlendMode", {
            sceneItemId: id,
            sceneName: scene,
          })
        ).sceneItemBlendMode;

        if (newBlendMode === blendMode) break;
        timeout++;
      }
    }

    async function SetSceneItemLockedAndValidate(scene, id, locked) {
      let timeout = 0;
      while (true && timeout < 5) {
        //set new transform, then fetch those applied settings
        await obs.call("SetSceneItemLocked", {
          sceneName: scene,
          sceneItemId: id,
          sceneItemLocked: locked,
          overlay: true,
        });

        const newLocked = (
          await obs.call("GetSceneItemLocked", {
            sceneItemId: id,
            sceneName: scene,
          })
        ).sceneItemLocked;

        if (locked === newLocked) break;
        timeout++;
      }
    }

    async function SetSceneItemTransformAndValidate(scene, id, transform) {
      let timeout = 0;
      while (true && timeout < 5) {
        //set new transform, then fetch those applied settings
        await obs.call("SetSceneItemTransform", {
          sceneName: scene,
          sceneItemId: id,
          sceneItemTransform: transform,
          overlay: true,
        });

        const newSettings = (
          await obs.call("GetSceneItemTransform", {
            sceneItemId: id,
            sceneName: scene,
          })
        ).sceneItemTransform;

        let passCheck = true;
        for (const ogSettingProp in transform) {
          const ogSetting = transform[ogSettingProp];
          const newSetting = newSettings[ogSettingProp];

          if (!isEqual(ogSetting, newSetting)) {
            passCheck = false;
            break;
          }
        }
        if (passCheck) break;
        timeout++;
      }
    }

    async function createInput(sourceData) {
      let sceneSourceHash =
        "UID-" +
        utils.calculateHashString(
          "" + sourceData.sceneName + sourceData.name,
          "md5"
        ); //UID-somehashhere
      let offset = offsets[sceneSourceHash];
      if (offset === undefined) offset = 0;

      let itemExists = true;
      //console.log("checking if source exists", sourceData.name);
      let sceneItemId = await sourceExists(
        sourceData.sceneName,
        sourceData.name,
        offset
      );
      if (!sceneItemId) {
        itemExists = false;
      }

      offsets[sceneSourceHash] = offset + 1;

      //? create or overlay process, kinda complicated, but i think it works. should have sceneid by the end of all this
      if (sourceData.isStandardInput == true && itemExists == false) {
        //figure out of this has been made prior already
        if (loadedScenes.sourceNames.includes(sourceData.name)) {
          //oh no, it already exists! change it as such!
          //also overlay settings
          sourceData.isStandardInput == false;
          // await obs.call("SetInputSettings", {
          //   inputName: sourceData.name,
          //   inputSettings: JSON.parse(sourceData.settings),
          //   overlay: true,
          // });
          await SetInputSettingsAndValidate(
            sourceData.name,
            JSON.parse(sourceData.settings)
          );
        }
      }
      if (sourceData.isStandardInput == true) {
        if (itemExists == false) {
          //create
          let resp;
          try {
            while (true) {
              if (sourceData.type.includes("text_gdiplus"))
                sourceData.type = determineTextGDIVersion(sourceData.type);
              resp = await obs.call("CreateInput", {
                sceneName: sourceData.sceneName,
                inputName: sourceData.name,
                inputKind: sourceData.type,
                inputSettings: JSON.parse(sourceData.settings),
                sceneItemEnabled: utils.stringToBool(sourceData.visibility),
              });
              if (await validateCreateInput(sourceData.name)) break;
            }
          } catch (e) {
            //incase of fringe case where item doesnt exist, but exists via reference
            while (true) {
              //console.log("calling create scene item");
              resp = await obs.call("CreateSceneItem", {
                sceneName: sourceData.sceneName,
                sourceName: sourceData.name,
                sceneItemEnabled: utils.stringToBool(sourceData.visibility),
              });
              //console.log("pass");
              if (
                await validateCreateSceneItem(
                  sourceData.sceneName,
                  resp.sceneItemId
                )
              )
                break;
            }
          }
          sceneItemId = resp.sceneItemId;
        } else {
          //overlay
          // await obs.call("SetInputSettings", {
          //   inputName: sourceData.name,
          //   inputSettings: JSON.parse(sourceData.settings),
          //   overlay: true,
          // });
          await SetInputSettingsAndValidate(
            sourceData.name,
            JSON.parse(sourceData.settings)
          );
        }
      } else {
        //not standard input, is nested scene or referenced source.
        if (itemExists == false) {
          //create scene item, which is nested scene or a ref.
          let resp;
          while (true) {
            resp = await obs.call("CreateSceneItem", {
              sceneName: sourceData.sceneName,
              sourceName: sourceData.name,
              sceneItemEnabled: utils.stringToBool(sourceData.visibility),
            });
            if (
              await validateCreateSceneItem(
                sourceData.sceneName,
                resp.sceneItemId
              )
            )
              break;
          }
          sceneItemId = resp.sceneItemId;
        }
      }

      //? create/overlay process end
      // ok should have a scene item id now, whether existing or not
      //we'll do a check just in case, but continue
      if (!sceneItemId)
        if (sourceData.type == "source-clone") {
          kickstartSourceClone(sourceData.name);
        }

      //filters n such
      for (let i = 0; i < sourceData.filters.length; i++) {
        const filterData = sourceData.filters[i];
        await addOrUpdateFilter(sourceData.name, filterData);
      }
      return sceneItemId;
    }

    async function kickstartSourceClone(cloneName) {
      const inputSettings = await obs.call("GetInputSettings", {
        inputName: cloneName,
      });
      const audioState = inputSettings.inputSettings.audio;

      //flip flop!

      await obs.call("SetInputSettings", {
        inputName: cloneName,
        inputSettings: {
          audio: !audioState,
        },
        overlay: true,
      });

      await obs.call("SetInputSettings", {
        inputName: cloneName,
        inputSettings: {
          audio: audioState,
        },
        overlay: true,
      });
    }

    function packagerEnd(item) {
      if (item.end) return true;
      return false;
    }

    async function sourceExists(targetSceneName, targetSourceName, offset) {
      // console.log(targetSceneName, targetSourceName, offset)
      try {
        const itemExists = await obs.call("GetSceneItemId", {
          sceneName: targetSceneName,
          sourceName: targetSourceName,
          searchOffset: offset,
        });
        return itemExists.sceneItemId;
      } catch {
        return undefined;
      }
    }

    async function sceneExists(targetSceneName) {
      const sceneList = await getSceneList();

      for (let i = 0; i < sceneList.length; i++) {
        const scene = sceneList[i];
        const sceneName = scene.sceneName;

        if (sceneName === targetSceneName) {
          return true;
        }
      }
      return false;
    }

    async function addOrUpdateFilter(sourceName, filterData) {
      // console.log('add or update filter', sourceName, filterData.name)
      const filterReal = await filterExists(sourceName, filterData.name);
      if (!filterReal) {
        while (true) {
          //create
          await obs.call("CreateSourceFilter", {
            sourceName: sourceName,
            filterName: filterData.name,
            filterKind: filterData.type,
            filterSettings: JSON.parse(filterData.settings),
          });
          if (filterExists(sourceName, filterData.name)) break;
        }
      } else {
        //overwrite
        // await obs.call("SetSourceFilterSettings", {
        //   sourceName: sourceName,
        //   filterName: filterData.name,
        //   filterSettings: JSON.parse(filterData.settings),
        // });
        await SetSourceFilterSettingsAndValidate(
          sourceName,
          filterData.name,
          JSON.parse(filterData.settings)
        );
      }

      //now that filter is up to date, set it's vis level
      await obs.call("SetSourceFilterEnabled", {
        sourceName: sourceName,
        filterName: filterData.name,
        filterEnabled: utils.stringToBool(filterData.visibility),
      });
    }

    async function SetSourceFilterSettingsAndValidate(
      source,
      filterName,
      filterSettings
    ) {
      // console.log('set input settings', inputName)
      // const ogSettings = (
      //   await obs.call("GetInputSettings", { inputName: inputName })
      // ).inputSettings;

      while (true) {
        //set new settings, then fetch those applied settings
        await obs.call("SetSourceFilterSettings", {
          filterName: filterName,
          sourceName: source,
          filterSettings: filterSettings,
          overlay: true,
        });

        const newSettings = (
          await obs.call("GetSourceFilter", {
            sourceName: source,
            filterName: filterName,
          })
        ).filterSettings;
        let passCheck = true;
        for (const ogSettingProp in filterSettings) {
          const ogSetting = filterSettings[ogSettingProp];
          const newSetting = newSettings[ogSettingProp];

          if (!isEqual(ogSetting, newSetting)) {
            passCheck = false;
            break;
          }
        }
        if (passCheck) break;
      }
    }

    async function filterExists(sourceName, filterName) {
      try {
        const result = await obs.call("GetSourceFilter", {
          sourceName: sourceName,
          filterName: filterName,
        });
        return true;
      } catch {
        return false;
      }
    }

    async function SetInputSettingsAndValidate(inputName, inputSettings) {
      // console.log('set input settings', inputName)
      // const ogSettings = (
      //   await obs.call("GetInputSettings", { inputName: inputName })
      // ).inputSettings;

      while (true) {
        //set new settings, then fetch those applied settings
        await obs.call("SetInputSettings", {
          inputName: inputName,
          inputSettings: inputSettings,
          overlay: true,
        });

        const newSettings = (
          await obs.call("GetInputSettings", { inputName: inputName })
        ).inputSettings;
        let passCheck = true;
        for (const ogSettingProp in inputSettings) {
          const ogSetting = inputSettings[ogSettingProp];
          const newSetting = newSettings[ogSettingProp];

          if (!isEqual(ogSetting, newSetting)) {
            passCheck = false;
            break;
          }
        }
        if (passCheck) break;
      }
    }

    async function validateCreateInput(inputName) {
      // console.log('create input', inputName)
      try {
        const resp = await obs.call("GetInputSettings", {
          inputName: inputName,
        });
        return true;
      } catch {
        return false;
      }
    }

    async function validateCreateSceneItem(sceneName, id) {
      // console.log('create scene item', sceneName, id)
      try {
        const resp = await obs.call("GetSceneItemEnabled", {
          sceneName: sceneName,
          sceneItemId: id,
        });
        return true;
      } catch {
        return false;
      }
    }

    function determineTextGDIVersion(type) {
      if (semver.gt(obsVersion, "30.1.2")) return "text_gdiplus_v3";
      return "text_gdiplus_v2";
    }
  },
  async sceneExists(scene) {
    try {
      const res = await obs.call("GetSceneList");
      const scenes = res.scenes.map(o => o.sceneName);
      return scenes.includes(scene);
    } catch(e) {
      return false;
    }
  }
};
