<script>
	import { onDestroy, onMount } from "svelte";
	import { Confirm } from "svelte-confirm";
	import IoIosShare from "svelte-icons/io/IoIosShare.svelte";
	import IoIosVolumeOff from "svelte-icons/io/IoIosVolumeOff.svelte";
	import IoIosVolumeHigh from "svelte-icons/io/IoIosVolumeHigh.svelte";
	import IoMdEyeOff from "svelte-icons/io/IoMdEyeOff.svelte";
	import IoMdEye from "svelte-icons/io/IoMdEye.svelte";
	import IoMdCall from "svelte-icons/io/IoMdCall.svelte";
	import VideoPane from "./VideoPane.svelte";
	import IoIosVideocam from "svelte-icons/io/IoIosVideocam.svelte";
	import { DoubleBounce } from "svelte-loading-spinners";

	/**
	 * TODO:
	 * make sure all resources are closed when disconnecting - volumenode and screensharing
	 * display symbol on muted
	 */
	export let debugMode = true;

	let token = debugMode
		? "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.eyJqdGkiOiJTS2JiN2YzZGMzZTFkYjkwY2VhNzEyMWNjOTNmMDM1NGRkLTE2MDM5ODMwOTYiLCJpc3MiOiJTS2JiN2YzZGMzZTFkYjkwY2VhNzEyMWNjOTNmMDM1NGRkIiwic3ViIjoiQUMxNTIwMDRlZDIxNTMwN2IzM2NkODM1ODNjMWJhZTE4MSIsImV4cCI6MTYwMzk4NjY5NiwiZ3JhbnRzIjp7ImlkZW50aXR5Ijoib3dlbiIsInZpZGVvIjp7InJvb20iOiJjb29sIHJvb20ifX19.so-lJx-Kq7Kzu_6zv01P_49xnlqmEMrZRsreJC2R-zk"
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
	let mainStream = null;
	let mainStreamId = null;
	let mainStreamPinned = false;

	let joinCallAudio = new Audio(audioDirectory + "startcall.mp3");
	let endCallAudio = new Audio(audioDirectory + "endcall.mp3");
	let buttonClickAudio = new Audio(audioDirectory + "click.mp3");

	let localStream = {
		id: null,
		videoStream: null,
		audioStream: null,
		screenStream: null,
	};
	let streams = [];
	let muted = false;
	let videoHidden = false;
	let volumes = {};
	let remoteMuted = {};

	function reset() {
		joinPromise = null;
		room = null;
		mainStreamId = null;
		mainStream = null;
		mainStreamPinned = false;
		localStream.id = null;
		localStream.videoStream = null;
		localStream.audioStream = null;
		if (localStream.screenStream != null) {
			localStream.screenStream.stop();
			localStream.screenStream = null;
		}
		streams = [];
		muted = false;
		videoHidden = false;
		volumes = {};
	}

	setInterval(decideMainStream, 1000);

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
	});

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
				updateStream(part);
			});

			room.on("trackPublished", (publication, part) => {
				console.log("trackPublished: ", part);
				updateStream(part);
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
					addAudioStream(part);
				} else {
					updateVideoStream(part);
				}
			});

			room.on("trackDisabled", (publication, part) => {
				if (publication.kind === "audio")
					remoteMuted[part.identity] = true;

				console.log("trackDisabled: ", publication.kind, part.identity);
			});

			room.on("trackEnabled", (publication, part) => {
				if (publication.kind === "audio")
					remoteMuted[part.identity] = false;

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
		room.localParticipant.audioTracks.forEach((track) => {
			muted = !muted;
			if (muted) track.track.disable();
			else track.track.enable();
		});
	}

	function toggleVideo() {
		buttonClickAudio.play();
		room.localParticipant.videoTracks.forEach((track) => {
			videoHidden = !videoHidden;
			if (videoHidden) track.track.disable();
			else track.track.enable();
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
			});
		} else {
			room.localParticipant.unpublishTrack(localStream.screenStream);
			localStream.screenStream.stop();
			localStream.screenStream = null;
		}
	}

	function endCall() {
		if (room == null) {
			initializeRoom();
		} else {
			room.disconnect();
			endCallAudio.play();
			reset();
		}
	}

	function updateVideoStream(participant) {
		for (const elem of streams) {
			if (elem.id == participant.identity) {
				elem.audioStreams = Array.from(participant.audioTracks.values())
					.filter((x) => x.track != null)
					.map((x) => x.track.mediaStreamTrack);
				if (elem.audioStreams.length >= 1 && elem.volumeNode == null) {
					elem.volumeNode = createVolumeNode(
						elem.id,
						elem.audioStreams[0]
					);
				}
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
					.map((x) => x.track.mediaStreamTrack);
				if (elem.audioStreams.length >= 1 && elem.volumeNode == null) {
					elem.audioOutput = audioContext.createMediaStreamSource(
						elem.audioStreams
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
		var data = {
			id: participant.identity,
			participant: participant,
			videoStreams: [],
			audioStreams: [],
		};
		volumes[data.id] = 0;
		streams = [...streams, data];
		updateStream(participant);
		joinCallAudio.play();
	}

	function removeParticipant(participant) {
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
</script>

<style>
	div.container {
		/* border: 1px solid rgb(100, 100, 100); */
		background-color: rgb(200, 200, 200);
	}
	.video-outer > img {
		width: 66%;
	}
	.video-outer {
		position: relative;
		display: inline-block; /* shrink wrap */
		width: 100%;
		height: auto;
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
		width: 16px;
		height: 16px;
		margin-top: auto;
		margin-bottom: auto;
		margin-right: 10px;
	}
	.icon-button {
		display: flex;
		align-content: center;
		margin: 3px 2px;
	}
</style>

{#if streams.length <= 4}
	<style>
		.mainVideo {
			flex: 4;
		}
		.remote {
			flex-basis: 100%;
		}
	</style>
{:else}
	<style>
		.mainVideo {
			flex: 2;
		}
		.remote {
			flex-basis: 40%;
		}
	</style>
{/if}

<svelte:head>
	{#if debugMode}
		<script
			src="https://media.twiliocdn.com/sdk/js/video/releases/2.7.2/twilio-video.min.js">
		</script>
	{/if}
</svelte:head>

{#if joinPromise == null}
	<!-- Application has not been initialized, show prompt to user -->
	<div
		style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
		<div style="color: black; width: 100px">
			<IoIosVideocam />
		</div>
		<button class="icon-button" on:click={initialize}><div class="icon">
				<IoMdCall />
			</div>Start Call</button>
	</div>
{:else}
	{#await joinPromise}
		<!-- Wait for room to be created -->
		<div
			style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
			<DoubleBounce size="60" />
			<p>Connecting...</p>
		</div>
	{:then room}
		<!-- Display room -->
		<div style="width: 100%; height: 100%; position: relative">
			<!-- Control panel -->
			<div
				style="position: sticky; top: 10px; width: 100%; display: flex; flex-direction: row; justify-content: center; align-items: center; z-index: 40">
				<!-- Mute -->
				<button class="icon-button" on:click={toggleMute}>{#if muted}
						<div class="icon">
							<IoIosVolumeHigh />
						</div>Unmute
					{:else}
						<div class="icon">
							<IoIosVolumeOff />
						</div>Mute
					{/if}</button>
				<!-- Turn video on/off -->
				<button
					class="icon-button"
					on:click={toggleVideo}>{#if videoHidden}
						<div class="icon">
							<IoMdEye />
						</div>Show video
					{:else}
						<div class="icon">
							<IoMdEyeOff />
						</div>Stop video
					{/if}</button>
				<!-- End call, request confirmation if there are other users in the call -->
				{#if streams.length == 0}
					<button class="icon-button" on:click={endCall}><div
							class="icon">
							<IoMdCall />
						</div>End Call</button>
				{:else}
					<Confirm let:confirm={confirmThis}>
						<button
							class="icon-button"
							on:click={() => confirmThis(endCall)}><div
								class="icon">
								<IoMdCall />
							</div>End Call</button>

						<span slot="title"> End Call </span>
						<span slot="description">
							Are you sure you want to end the call?
						</span>
					</Confirm>
				{/if}
				<!-- Screen sharing -->
				<button class="icon-button" on:click={shareScreen}>
					<div class="icon">
						<IoIosShare />
					</div>{#if localStream.screenStream != null}
						Unshare screen
					{:else}Share screen{/if}</button>
			</div>
			<!-- End control panel -->
			<div
				style="width: 100%; height: 100%; display: flex; flex-direction: row; position: absolute; top: 0">
				<div class="mainVideo">
					<!-- Main video pane -->
					<div class="container" style="width: 100%; ">
						<div class="video-outer">
							<img
								src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
								alt="backing" />
							<div class="video-contents">
								{#if mainStreamPinned}
									<button
										style="position: absolute; top: 0; right: 0; z-index: 10"
										on:click={() => {
											mainStreamId = null;
											mainStream = null;
											mainStreamPinned = false;
										}}>Unpin</button>
								{/if}
								<video use:srcObject={[mainStream]} autoplay>
									<track kind="captions" />
								</video>
							</div>
						</div>
					</div>
				</div>
				<div
					class="sub container"
					style="flex: 1; display: flex; flex-wrap: wrap; align-content: flex-start;">
					{#each streams as stream (stream.id)}
						<VideoPane
							{buttonClickAudio}
							videoStreams={stream.videoStreams}
							audioStreams={stream.audioStreams}
							muted={false}
							mainId={mainStreamId}
							mainPinned={mainStreamPinned}
							id={stream.id}
							volume={volumes[stream.id] || 0} />
					{/each}

					<VideoPane
						{buttonClickAudio}
						muted={false}
						mainId={mainStreamId}
						mainPinned={mainStreamPinned}
						id={'Hello'}
						volume={0.1} />
					<VideoPane
						{buttonClickAudio}
						{muted}
						mainId={mainStreamId}
						mainPinned={mainStreamPinned}
						id={localStream.id}
						videoStreams={[localStream.screenStream, localStream.videoStream]}
						audioStreams={[localStream.audioStream]}
						volume={volumes[localStream.id]} />
				</div>
			</div>
		</div>
	{:catch error}
		<p>Failed to join room: {error.message}</p>
	{/await}
{/if}
