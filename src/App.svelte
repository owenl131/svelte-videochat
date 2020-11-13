<script>
	import { onDestroy, onMount } from "svelte";
	import { DoubleBounce } from "svelte-loading-spinners";
	import IoMdCall from "svelte-icons/io/IoMdCall.svelte";
	import IoIosVideocam from "svelte-icons/io/IoIosVideocam.svelte";
	import CommandPane from "./CommandPane.svelte";
	import VideoPane from "./VideoPane.svelte";
	import { fade } from "svelte/transition";
	import { SvelteToast } from "@zerodevx/svelte-toast";
	import { toast } from "@zerodevx/svelte-toast";
	import { missing_component } from "svelte/internal";

	/**
	 * TODO:
	 * make sure all resources are closed when disconnecting - volumenode and screensharing
	 * display symbol on muted
	 */
	export let debugMode = false;

	let token = debugMode
		? "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.eyJqdGkiOiJTS2JiN2YzZGMzZTFkYjkwY2VhNzEyMWNjOTNmMDM1NGRkLTE2MDUyNTY5MjkiLCJpc3MiOiJTS2JiN2YzZGMzZTFkYjkwY2VhNzEyMWNjOTNmMDM1NGRkIiwic3ViIjoiQUMxNTIwMDRlZDIxNTMwN2IzM2NkODM1ODNjMWJhZTE4MSIsImV4cCI6MTYwNTI2MDUyOSwiZ3JhbnRzIjp7ImlkZW50aXR5IjoiYmFycnkiLCJ2aWRlbyI6eyJyb29tIjoiY29vbCByb29tIn19fQ.enu19Rbw9pn_0JvIY89yBndUwSb6okzyizY6QUZHfko"
		: null;
	let audioDirectory = debugMode
		? "./"
		: "/wp-content/plugins/BuddyBoss-Video/";
	let roomname = debugMode ? "cool room" : null;
	const volumeNodeSource = debugMode
		? "volumeprocessor.js"
		: "/wp-content/plugins/BuddyBoss-Video/volumeprocessor.js";

	let joinPromise = null;
	let room = null;
	// for "Speaker" view
	let mainStream = null;
	let mainStreamId = null;
	let mainStreamPinned = false;
	// for "Panel" view
	let mainSpeaker = null;

	let layout = "panel"; // or "main"

	let joinCallAudio = new Audio(audioDirectory + "startcall.mp3");
	let endCallAudio = new Audio(audioDirectory + "endcall.mp3");
	let buttonClickAudio = new Audio(audioDirectory + "click.mp3");

	let screenWidth, screenHeight;

	let localStream = {
		id: null,
		videoStream: null,
		audioStream: null,
		screenStream: null,
		audioOutput: null,
	};
	let streams = [];
	let muted = false;
	let videoHidden = false;
	let volumes = {};
	let remoteMuted = {};

	let options = {
		theme: {
			"--toastHeight": "6rem",
		},
	};

	function reset() {
		joinPromise = null;
		room = null;
		mainStreamId = null;
		mainStream = null;
		mainStreamPinned = false;
		localStream.id = null;
		localStream.videoStream = null;
		localStream.audioStream = null;
		localStream.audioOutput = null;
		if (localStream.screenStream != null) {
			localStream.screenStream.stop();
			localStream.screenStream = null;
		}
		streams = [];
		muted = false;
		videoHidden = false;
		volumes = {};
	}

	setInterval(decideMainStream, 2000);
	setInterval(decideMainSpeaker, 100);

	let audioContext = null;

	onDestroy(() => {
		if (room != null) {
			room.disconnect();
		}
	});

	onMount(async () => {
		console.log("onload");
		if (token == null)
			token = document.getElementById("video-user-token").value;
		if (roomname == null)
			roomname = document.getElementById("video-room").value;
		initialize();
	});

	function switchViewLayout() {
		buttonClickAudio.play();
		if (layout === "main") {
			layout = "panel";
			mainStreamId = null;
			mainStreamPinned = false;
			mainStream = null;
		} else {
			layout = "main";
		}
	}

	function createVolumeNode(label) {
		let volumeNode = new AudioWorkletNode(audioContext, "volume-processor");
		volumeNode.port.onmessage = (event) => {
			if (event.data.volume) {
				if (!isNaN(event.data.volume) && label) {
					volumes[label] = event.data.volume;
					volumes = volumes;
				}
			}
		};
		return volumeNode;
	}

	function initialize() {
		if (audioContext == null) {
			audioContext = new AudioContext();
		}
		audioContext.audioWorklet
			.addModule(volumeNodeSource)
			.then(initializeRoom)
			.catch((e) => {
				console.log(e);
			});
	}

	function initializeRoom() {
		if (token == null || roomname == null || window.Twilio == null) {
			return;
		}
		const connect = window.Twilio.Video.connect;

		joinPromise = connect(token, {
			name: roomname,
			audio: true,
			video: { width: 640 },
		});

		joinPromise.then((_room) => {
			room = _room;
			console.log(`Successfully joined a Room: ${room}`);
			localStream.id = room.localParticipant.identity;
			localStream.videoStream = room.localParticipant.videoTracks
				.values()
				.next().value.track.mediaStreamTrack;
			localStream.audioStream = room.localParticipant.audioTracks
				.values()
				.next().value.track.mediaStreamTrack;
			localStream.audioOutput = audioContext.createMediaStreamSource(
				new MediaStream([localStream.audioStream])
			);
			localStream.volumeNode = createVolumeNode(localStream.id);
			localStream.audioOutput.connect(localStream.volumeNode);

			volumes[localStream.id] = 0;

			room.participants.forEach(addParticipant);
			room.on("participantConnected", addParticipant);
			room.on("participantDisconnected", removeParticipant);

			room.on("disconnected", (room) => {
				console.log("disconnected");
				reset();
			});

			room.on("trackSubscribed", (track, publication, part) => {
				console.log("trackSubscribed: ", part);
				if (publication.kind === "audio") {
					addAudioStream(part);
				} else {
					updateVideoStream(part);
				}
			});

			room.on("trackPublished", (publication, part) => {
				console.log("trackPublished: ", part);
				if (publication.kind === "audio") {
					addAudioStream(part);
				} else {
					updateVideoStream(part);
				}
			});

			room.on("trackUnsubscribed", (track, publication, part) => {
				console.log("trackUnsubscribed: ", part);
				if (publication.kind === "audio") {
					removeAudioStream(part);
				} else {
					updateVideoStream(part);
				}
			});

			room.on("trackUnpublished", (publication, part) => {
				console.log("trackUnpublished: ", part);
				if (publication.kind === "audio") {
					removeAudioStream(part);
				} else {
					updateVideoStream(part);
				}
			});

			room.on("trackDisabled", (publication, part) => {
				if (publication.kind === "audio") {
					remoteMuted[part.identity] = true;
					remoteMuted = remoteMuted;
				}

				console.log("trackDisabled: ", publication.kind, part.identity);
			});

			room.on("trackEnabled", (publication, part) => {
				if (publication.kind === "audio") {
					remoteMuted[part.identity] = false;
					remoteMuted = remoteMuted;
				}

				console.log("trackEnabled: ", publication.kind, part.identity);
			});

			room.on("trackSwitchedOff", (track, publication, part) => {
				console.log(
					"trackSwitchedOff: ",
					publication.kind,
					part.identity
				);
			});

			room.on("trackSwitchedOn", (track, publication, part) => {
				console.log(
					"trackSwitchedOn: ",
					publication.kind,
					part.identity
				);
			});
		});
	}

	function toggleMute() {
		buttonClickAudio.play();
		muted = !muted;
		if (muted) {
			toast.push("Audio muted", options);
		} else {
			toast.push("Audio unmuted", options);
		}
		room.localParticipant.audioTracks.forEach((track) => {
			if (muted) {
				track.track.disable();
			} else {
				track.track.enable();
			}
		});
	}

	function toggleVideo() {
		buttonClickAudio.play();
		videoHidden = !videoHidden;
		if (videoHidden) {
			toast.push("Video hidden");
		} else {
			toast.push("Video shown");
		}
		room.localParticipant.videoTracks.forEach((track) => {
			if (videoHidden) {
				track.track.disable();
			} else {
				track.track.enable();
			}
		});
	}

	function shareScreen() {
		buttonClickAudio.play();
		if (localStream.screenStream == null) {
			navigator.mediaDevices.getDisplayMedia().then((stream) => {
				localStream.screenStream = stream.getTracks()[0];
				room.localParticipant.publishTrack(
					new window.Twilio.Video.LocalVideoTrack(
						localStream.screenStream
					)
				);
				toast.push("Screenshare started");
			});
		} else {
			room.localParticipant.unpublishTrack(localStream.screenStream);
			localStream.screenStream.stop();
			localStream.screenStream = null;
			toast.push("Screenshare stopped");
		}
	}

	function endCall() {
		if (room != null) {
			room.disconnect();
			endCallAudio.play();
			reset();
		}
		toast.push("Call ended");
		window.history.back();
	}

	function updateVideoStream(participant) {
		for (const elem of streams) {
			if (elem.id == participant.identity) {
				elem.videoStreams = Array.from(participant.videoTracks.values())
					.filter((x) => x.track != null)
					.map((x) => x.track.mediaStreamTrack);
				console.log(elem.audioStreams, elem.videoStreams);
			}
		}
		streams = streams;
	}

	function addAudioStream(participant) {
		for (const elem of streams) {
			if (elem.id == participant.identity) {
				elem.audioStreams = Array.from(participant.audioTracks.values())
					.filter((x) => x.track != null)
					.map((x) => x.track.mediaStreamTrack)
					.filter((x) => x != null);
				if (elem.audioStreams.length >= 1 && elem.volumeNode == null) {
					elem.audioOutput = audioContext.createMediaStreamSource(
						new MediaStream(elem.audioStreams)
					);
					elem.volumeNode = createVolumeNode(elem.id);
					elem.audioOutput.connect(elem.volumeNode);
				}
			}
		}
		streams = streams;
	}

	function removeAudioStream(participant) {
		for (const elem of streams) {
			if (elem.id == participant.identity) {
				elem.audioOutput.disconnect();
				elem.audioOutput = null;
				elem.volumeNode.port.postMessage({ msg: "end" });
				elem.volumeNode.port.onmessage = null;
				elem.volumeNode = null;
				elem.audioStreams = [];
			}
		}
		streams = streams;
	}

	function addParticipant(participant) {
		console.log("addParticipant", participant);
		toast.push(participant.identity + " joined the call.");
		var data = {
			id: participant.identity,
			participant: participant,
			videoStreams: [],
			audioStreams: [],
		};
		volumes[data.id] = 0;
		streams = [...streams, data];
		updateVideoStream(participant);
		addAudioStream(participant);
		joinCallAudio.play();
	}

	function removeParticipant(participant) {
		toast.push(participant.identity + " left the call.");
		streams = streams.filter((e) => e.id != participant.identity);
	}

	function decideMainStream() {
		if (room == null) {
			return;
		}
		if (mainStreamPinned) {
			return;
		}
		let maxVolume = 0;
		let maxId = null;
		for (const id in volumes) {
			if (id == room.localParticipant.identity) {
				continue;
			}
			if (volumes.hasOwnProperty(id)) {
				const v = volumes[id];
				if (maxId == null || v > maxVolume) {
					maxId = id;
					maxVolume = v;
				}
			}
		}
		if (maxId == null) {
			return;
		}
		for (const elem of streams) {
			if (elem.id == maxId) {
				if (elem.videoStreams == null) {
					return;
				}
				if (elem.videoStreams.length == 0) {
					return;
				}
				if (mainStream != null) {
					if (mainStream.label == elem.videoStreams[0].label) {
						return;
					}
				}
				mainStreamId = maxId;
				mainStream = elem.videoStreams[0].clone();
			}
		}
	}

	function decideMainSpeaker() {
		let maxVolume = 0.05;
		let maxId = null;
		for (const id in volumes) {
			if (volumes.hasOwnProperty(id)) {
				const v = volumes[id];
				if (v > maxVolume) {
					maxId = id;
					maxVolume = v;
				}
			}
		}
		mainSpeaker = maxId;
	}

	function srcObject(node, streams) {
		if (streams != null) {
			streams = Array.isArray(streams)
				? streams.filter((x) => x != null)
				: streams;
			node.srcObject = new MediaStream(streams);
		}
		return {
			update(nextStreams) {
				if (nextStreams != null) {
					nextStreams = Array.isArray(nextStreams)
						? nextStreams.filter((x) => x != null)
						: nextStreams;
					node.srcObject = new MediaStream(nextStreams);
				}
			},
			destroy() {
				/* stream revoking logic here */
			},
		};
	}

	function pinStream(id) {
		buttonClickAudio.play();
		if (mainStreamPinned && mainStreamId == id) {
			mainStreamId = null;
			mainStream = null;
			mainStreamPinned = false;
			return;
		}
		if (mainStreamId == id) {
			mainStreamPinned = true;
			return;
		}
		for (const elem of streams) {
			if (elem.id == maxId) {
				mainStream = elem.videoStreams[0].clone();
				mainStreamId = id;
				mainStreamPinned = true;
			}
		}
	}

	// function decideWidth(number, width, height) {
	// 	let aspectRatio = width / height;
	// 	let videoRatio = 4 / 3;
	// 	if (number == 1) {
	// 		return ((Math.min(aspectRatio, videoRatio) * height) / width) * 100;
	// 	}
	// 	if (number == 2) {
	// 		if (aspectRatio < videoRatio) {
	// 			// height 50%
	// 			return ((videoRatio * height) / 2 / width) * 100;
	// 		}
	// 		return 50;
	// 	}
	// 	if (number <= 6) {
	// 		return Math.min(50, ((videoRatio * height) / 2 / width) * 100);
	// 	}
	// 	return Math.min(33, ((videoRatio * height) / 3 / width) * 100);
	// }
	let videoRatio = 4 / 3;
	function decideWidth(number, width, height) {
		width -= 10;
		height -= 10;
		let aspectRatio = width / height;
		if (number == 1) {
			return Math.min(aspectRatio, videoRatio) * height - 5;
		}
		if (number == 2) {
			return Math.max(width / 2, videoRatio * (height / 2)) - 5;
		}
		if (number <= 4) {
			return Math.max(width / 2, videoRatio * (height / 3)) - 3;
		}
		if (number <= 6) {
			return Math.min(width / 2, (videoRatio * height) / 3) - 2;
		}
		return Math.min(width / 3, (videoRatio * height) / 3) - 1;
	}
</script>

<style>
	.noselect {
		-webkit-touch-callout: none; /* iOS Safari */
		-webkit-user-select: none; /* Safari */
		-khtml-user-select: none; /* Konqueror HTML */
		-moz-user-select: none; /* Old versions of Firefox */
		-ms-user-select: none; /* Internet Explorer/Edge */
		user-select: none; /* Non-prefixed version, currently
                                  supported by Chrome, Edge, Opera and Firefox */
	}
	div {
		margin: 0;
		padding: 0;
	}
	.full {
		width: 100%;
		height: 100%;
	}
	.video-outer > img {
		width: 75%;
	}
	.video-outer {
		position: relative;
		display: inline-block; /* shrink wrap */
		width: 100%;
		height: auto;
		max-height: 100%;
	}
	.video-contents {
		/* match size of .container, without influencing it */
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		right: 0;
		background-color: black;
	}
	video {
		/* center video in container */
		max-width: 100%;
		max-height: 100%;
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		-ms-transform: translate(-50%, -50%);
	}
	.icon {
		display: inline-block;
		color: white;
		width: 24px;
		height: 24px;
		margin: 4px 0px;
		align-self: center;
	}
	.icon-button {
		display: flex;
		flex-direction: row;
		align-content: center;
		margin: 3px 2px;
		line-height: initial;
	}
	.mainVideo {
		flex: 3;
	}
	@media screen and (max-width: 640px) {
		.mainVideo {
			flex: 2;
		}
	}
</style>

<svelte:head>
	{#if debugMode}
		<script
			src="https://media.twiliocdn.com/sdk/js/video/releases/2.7.2/twilio-video.min.js">
		</script>
	{/if}
</svelte:head>

<SvelteToast {options} />

{#if joinPromise == null}
	<!-- Application has not been initialized, show prompt to user -->
	<div
		style="width: 100%; height: 80vh; display: flex; align-items: center; justify-content: center; flex-direction: column;">
		<div style="color: black; width: 100px">
			<IoIosVideocam />
		</div>
		<button class="icon-button" on:click={initialize}><div class="icon">
				<IoMdCall />
			</div><span style="align-self: center; margin-left: 10px;">Start
				Call</span></button>
	</div>
{:else}
	{#await joinPromise}
		<!-- Wait for room to be created -->
		<div
			style="width: 100%; height: 80vh; display: flex; align-items: center; justify-content: center; flex-direction: column;">
			<div style="margin-top: 50px; margin-bottom: 20px">
				<DoubleBounce size="60" />
			</div>
			<p>Connecting...</p>
		</div>
	{:then room}
		<!-- Display room -->
		<div
			bind:clientWidth={screenWidth}
			bind:clientHeight={screenHeight}
			style="width: 100%; height: 80vh; position: relative; background: black">
			{#if audioContext == null}
				<div
					style="width: 100%; height: 100%; position: absolute; background: black; z-index: 100; opacity: 0.5">
					AudioContext could not be started
				</div>
			{:else if audioContext.state === 'suspended'}
				<div
					style="width: 100%; height: 100%; position: absolute; background: #00000044; z-index: 100; display: flex; justify-content: center; align-items: center">
					<button
						on:click={() => {
							audioContext.resume();
							audioContext = audioContext;
						}}>Join Call</button>
				</div>
			{:else}
				<!-- Control panel: mute, show/hide video, screenshare, endcall, change layout -->
				<div transition:fade>
					<CommandPane
						isMuted={muted}
						isVideoHidden={videoHidden}
						isScreenShared={localStream.screenStream != null}
						{layout}
						toggleView={switchViewLayout}
						{toggleMute}
						{toggleVideo}
						toggleScreenShare={shareScreen}
						{endCall} />
				</div>
				<!-- End control panel -->
			{/if}
			{#if layout == 'main'}
				<div
					class="full"
					style="position: absolute; top: 0; display: flex; flex-direction: row">
					<div class="mainVideo">
						<!-- Main video pane -->
						<div
							class="container"
							style="width: 100%; height: 100%;">
							<div class="video-outer">
								<img
									class="noselect"
									src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
									alt="backing" />
								<div class="video-contents">
									<video
										use:srcObject={[mainStream]}
										autoplay>
										<track kind="captions" />
									</video>
								</div>
							</div>
						</div>
					</div>
					<div
						class="sub container"
						style="flex: 1; display: flex; flex-wrap: wrap; align-content: flex-start; overflow: auto">
						{#each streams as stream (stream.id)}
							<VideoPane
								{buttonClickAudio}
								videoStreams={stream.videoStreams}
								audioStreams={stream.audioStreams}
								muted={remoteMuted[stream.id] || false}
								mainId={mainStreamId}
								id={stream.id}
								pinPressed={pinStream}
								isPinned={mainStreamPinned && mainStreamId == stream.id}
								rotateVideos={() => {
									stream.videoStreams = [...stream.videoStreams.slice(1), ...stream.videoStreams.slice(0, 1)];
									streams = streams;
									if (mainStreamId == stream.id) {
										mainStream = stream.videoStreams[0].clone();
									}
								}}
								volume={volumes[stream.id] || 0} />
						{/each}
						<VideoPane
							{buttonClickAudio}
							{muted}
							mainId={mainStreamId}
							id={localStream.id}
							videoStreams={[localStream.screenStream, localStream.videoStream]}
							audioStreams={[]}
							volume={volumes[localStream.id]} />
					</div>
				</div>
				<!-- End layout === 'main' -->
			{:else if layout === 'panel'}
				<div
					class="full"
					style="
						position: absolute; top: 0; display: flex;
						align-content: center; justify-content: center; flex-direction: row;
						flex-wrap: wrap; overflow: auto;">
					<div
						style="width: {decideWidth(streams.length + 1, screenWidth, screenHeight)}px;
							height: {decideWidth(streams.length + 1, screenWidth, screenHeight) / videoRatio}px">
						<VideoPane
							{buttonClickAudio}
							{muted}
							mainId={mainStreamId}
							id={localStream.id}
							videoStreams={[localStream.screenStream, localStream.videoStream]}
							audioStreams={[]}
							framed={mainSpeaker === localStream.id}
							volume={volumes[localStream.id]} />
					</div>
					{#each streams as stream (stream.id)}
						<div
							style="width: {decideWidth(streams.length + 1, screenWidth, screenHeight)}px;
								height: {decideWidth(streams.length + 1, screenWidth, screenHeight) / videoRatio}px">
							<VideoPane
								{buttonClickAudio}
								videoStreams={stream.videoStreams}
								audioStreams={stream.audioStreams}
								muted={remoteMuted[stream.id] || false}
								mainId={mainStreamId}
								id={stream.id}
								rotateVideos={() => {
									stream.videoStreams = [...stream.videoStreams.slice(1), ...stream.videoStreams.slice(0, 1)];
									streams = streams;
									if (mainStreamId == stream.id) {
										mainStream = stream.videoStreams[0].clone();
									}
								}}
								framed={mainSpeaker === stream.id}
								volume={volumes[stream.id] || 0} />
						</div>
					{/each}
				</div>
				<!-- End layout === "panel" -->
			{:else}Invalid layout{/if}
		</div>
	{:catch error}
		<p>Failed to join room: {error.message}</p>
	{/await}
{/if}
