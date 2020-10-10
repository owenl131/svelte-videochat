<script>
	import { onDestroy, onMount } from "svelte";
	import IoIosShare from "svelte-icons/io/IoIosShare.svelte";
	import IoIosVolumeOff from "svelte-icons/io/IoIosVolumeOff.svelte";
	import IoIosVolumeHigh from "svelte-icons/io/IoIosVolumeHigh.svelte";
	import IoMdEyeOff from "svelte-icons/io/IoMdEyeOff.svelte";
	import IoMdEye from "svelte-icons/io/IoMdEye.svelte";
	import IoIosExpand from "svelte-icons/io/IoIosExpand.svelte";
	import IoMdCall from "svelte-icons/io/IoMdCall.svelte";

	let token = null;
	// let token = "<insert token here>"
	// token =
	// "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.eyJqdGkiOiJTS2JiN2YzZGMzZTFkYjkwY2VhNzEyMWNjOTNmMDM1NGRkLTE2MDIxNTgwMTAiLCJpc3MiOiJTS2JiN2YzZGMzZTFkYjkwY2VhNzEyMWNjOTNmMDM1NGRkIiwic3ViIjoiQUMxNTIwMDRlZDIxNTMwN2IzM2NkODM1ODNjMWJhZTE4MSIsImV4cCI6MTYwMjE2MTYxMCwiZ3JhbnRzIjp7ImlkZW50aXR5Ijoib3dlbiIsInZpZGVvIjp7InJvb20iOiJjb29sIHJvb20ifX19.RO8P1WsBjcBmuIMl515rH2_3pIoAMWCdrm2Ei9JJbBk";

	let roomname = null;
	// let roomname = "cool room";
	// roomname = "cool room";
	let joinPromise = null;
	let room = null;
	let mainStream = null;
	let localStream = {
		videoStream: null,
		audioStream: null,
		screenStream: null,
	};
	let streams = [];
	let muted = false;
	let videoHidden = false;
	let volumes = {};

	const volumeNodeSource =
		"/wp-content/plugins/BuddyBoss-Video/volumeprocessor.js";
	// "volumeprocessor.js";
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
		console.log(token, roomname);
		// initialize();
	});

	function createVolumeNode(label, inputStream) {
		let volumeNode = new AudioWorkletNode(audioContext, "volume-processor");
		volumeNode.port.onmessage = (event) => {
			if (event.data.volume) {
				if (!isNaN(event.data.volume))
					volumes[label] = event.data.volume;
			}
		};
		audioContext
			.createMediaStreamSource(new MediaStream([inputStream]))
			.connect(volumeNode);
		return volumeNode;
	}

	function initialize() {
		if (audioContext == null) {
			audioContext = new AudioContext();
			audioContext.audioWorklet
				.addModule(volumeNodeSource)
				.then(initializeRoom)
				.catch((e) => {
					console.log(e);
				});
		}
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
			console.log(room.localParticipant.videoTracks);
			localStream.videoStream = room.localParticipant.videoTracks
				.values()
				.next().value.track.mediaStreamTrack;
			localStream.audioStream = room.localParticipant.audioTracks
				.values()
				.next().value.track.mediaStreamTrack;

			volumes[room.localParticipant.identity] = 0;

			room.participants.forEach(addParticipant);
			room.on("participantConnected", addParticipant);
			room.on("participantDisconnected", removeParticipant);

			room.on("disconnected", (room) => {
				streams = [];
				localStream.audioStream = null;
				localStream.videoStream = null;
				localStream.screenStream = null;
				localStream.volumeNode = null;
			});

			localStream.volumeNode = createVolumeNode(
				localStream.identity,
				localStream.audioStream
			);
		});
	}

	function toggleMute() {
		room.localParticipant.audioTracks.forEach((track) => {
			muted = !muted;
			if (muted) track.track.disable();
			else track.track.enable();
		});
	}

	function toggleVideo() {
		room.localParticipant.videoTracks.forEach((track) => {
			videoHidden = !videoHidden;
			if (videoHidden) track.track.disable();
			else track.track.enable();
		});
	}

	function shareScreen() {
		if (localStream.screenStream == null) {
			navigator.mediaDevices.getDisplayMedia().then((stream) => {
				console.log(stream);
				localStream.screenStream = stream.getTracks()[0];
				room.localParticipant.publishTrack(
					new window.Twilio.Video.LocalVideoTrack(
						stream.getTracks()[0]
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
			room = null;
			joinPromise = null;
			streams = [];
			volumes = {};
			localStream.audioStream = null;
			localStream.videoStream = null;
			localStream.screenStream = null;
			localStream.volumeNode = null;
		}
	}

	function updateStream(participant, track) {
		console.log(`Got ${track.kind} from ${participant.identity}`);
		for (const elem of streams) {
			if (elem.id == participant.identity) {
				if (track.kind == "audio") {
					elem.audioStream = track.mediaStreamTrack;
					elem.volumeNode = createVolumeNode(
						elem.id,
						elem.audioStream
					);
				} else if (track.kind == "video") {
					elem.videoStream = track.mediaStreamTrack;
				}
			}
		}
		streams = streams;
	}

	function addParticipant(participant) {
		console.log(participant);
		var data = {
			id: participant.identity,
			participant: participant,
			videoStream: null,
			audioStream: null,
		};
		participant.tracks.forEach((publication) => {
			if (publication.track) {
				console.log(
					`Got ${publication.track.kind} from ${participant.identity}`
				);
				if (publication.track.kind == "video") {
					data.videoStream = publication.track.mediaStreamTrack;
				} else if (publication.track.kind == "audio") {
					data.audioStream = publication.track.mediaStreamTrack;
				}
			}
		});
		participant.on("trackSubscribed", (track) => {
			updateStream(participant, track);
		});
		participant.on("trackUnsubscribed", (track, publication) => {
			console.log("unsubscribed", participant, track, publication);
		});
		participant.on("trackUnpublished", (publication) => {
			console.log("unpublished", publication);
		});
		streams = [...streams, data];
	}

	function removeParticipant(participant) {
		streams = streams.filter((e) => e.id != participant.identity);
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
		border-radius: 10px;
		/* border: 1px solid rgb(100, 100, 100); */
		background-color: rgb(200, 200, 200);
		margin: 5px 5px;
		padding: 10px 20px;
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
		background-color: rgb(50, 50, 50);
	}
	video {
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
	}
</style>

<svelte:head>
	<script
		src="//media.twiliocdn.com/sdk/js/video/releases/2.7.2/twilio-video.min.js">
	</script>
</svelte:head>

<div>
	{#if joinPromise == null}
		<button class="icon-button" on:click={initialize}><div class="icon">
				<IoMdCall />
			</div>Start Call</button>
	{:else}
		{#await joinPromise}
			<p>Connecting...</p>
		{:then room}
			{#if streams.length <= 4}
				<style>
					.mainVideo {
						flex: 4;
					}
				</style>
			{:else}
				<style>
					.mainVideo {
						flex: 2;
					}
				</style>
			{/if}
			<div style="display: flex; height: 100%">
				<div class="mainVideo">
					<div
						style="display: flex; flex-direction: column; height: 100%; margin-right: 10px">
						<div class="container" style="width: 100%; ">
							<div class="video-outer">
								<img
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
						<div
							class="container"
							style="flex: 1; display: flex; overflow: hidden; width: 100%">
							<div style="flex: 1; margin-right: 20px;">
								<div
									class="video-outer"
									style="max-height: 25vh">
									<img
										src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
										alt="backing"
										style="max-height: 25vh" />
									<div class="video-contents">
										<video
											autoplay
											use:srcObject={localStream.screenStream != null ? [localStream.screenStream, localStream.videoStream] : [localStream.videoStream, localStream.audioStream]}
											muted>
											<track kind="captions" />
										</video>
										<div
											style="height: 100%; position: absolute; top: 0; left: 0">
											<img
												src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
												alt="backing"
												style="height: 100%" />
											<meter
												min="0"
												max="0.1"
												style="transform: rotate(-90deg); transform-origin: bottom left; width: 100%; position: absolute; bottom: 0; left: 0"
												value={localStream.id in volumes ? volumes[localStream.id] : 0} />
										</div>
									</div>
								</div>
							</div>
							<div style="display: flex; flex-direction: column">
								<style>
									button {
										margin: 2px;
									}
								</style><button
									class="icon-button"
									on:click={toggleMute}>{#if muted}
										<div class="icon">
											<IoIosVolumeHigh />
										</div>Unmute
									{:else}
										<div class="icon">
											<IoIosVolumeOff />
										</div>Mute
									{/if}</button>
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
								<button
									class="icon-button"
									on:click={endCall}><div class="icon">
										<IoMdCall />
									</div>{#if room == null}
										Start Call
									{:else}End Call{/if}</button>
								<button
									class="icon-button"
									on:click={shareScreen}>
									<div class="icon">
										<IoIosShare />
									</div>Share screen</button>
							</div>
						</div>
					</div>
				</div>
				<div
					class="sub container"
					style="flex: 1; display: flex; flex-wrap: wrap; align-content: flex-start;">
					{#each streams as stream (stream.id)}
						<div
							class="remote"
							style="position: relative; margin-bottom: 10px;">
							{#if streams.length <= 4}
								<style>
									.remote {
										flex-basis: 100%;
									}
								</style>
							{:else}
								<style>
									.remote {
										flex-basis: 40%;
									}
								</style>
							{/if}
							<div class="video-outer">
								<img
									src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
									alt="backing" />
								<div class="video-contents">
									<video
										use:srcObject={[stream.videoStream, stream.audioStream]}
										autoplay>
										<track kind="captions" /></video>
									<div
										style="height: 100%; position: absolute; top: 0; left: 0">
										<img
											src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
											alt="backing"
											style="height: 100%" />
										<meter
											min="0"
											max="0.1"
											style="transform: rotate(-90deg); transform-origin: bottom left; width: 100%; position: absolute; bottom: 0; left: 0"
											value={stream.id in volumes ? volumes[stream.id] : 0} />
									</div>
								</div>
							</div>
							<div
								style="position: absolute; top: 0; right: 0; background-color: rgba(0, 0, 0, 0.2); display: flex; justify-content: center;">
								<span
									style="color: white; margin: auto 5px;">{stream.id}</span>
								<button
									style="padding: 0 10px; display: flex; justify-content: center"
									on:click={() => {
										mainStream = stream.videoStream.clone();
									}}><div
										class="icon"
										style="margin-right: 0">
										<IoIosExpand />
									</div></button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{:catch error}
			<p>Failed to join room: {error.message}</p>
		{/await}
	{/if}
</div>
