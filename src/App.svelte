<script>
	import { onDestroy, onMount } from "svelte";

	let token = null;
	// let token = "<insert token here>"
	let roomname = null;
	// let roomname = "cool room";
	let joinPromise = null;
	let room = null;
	let mainStream = null;
	let localStream = { videoStream: null, audioStream: null };
	let streams = [];
	let muted = false;
	let videoHidden = false;
	let volumes = {};

	const volumeNodeSource =
		"/wp-content/plugins/BuddyBoss-Video/volumeprocessor.js";

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
			localStream = {
				videoStream: room.localParticipant.videoTracks.values().next()
					.value.track.mediaStreamTrack,
				audioStream: room.localParticipant.audioTracks.values().next()
					.value.track.mediaStreamTrack,
			};
			volumes[room.localParticipant.identity] = 0;

			room.participants.forEach(addParticipant);
			room.on("participantConnected", addParticipant);
			room.on("participantDisconnected", removeParticipant);

			room.on("disconnected", (room) => {
				streams = [];
				localStream = null;
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

	function endCall() {
		if (room == null) {
			initializeRoom();
		} else {
			room.disconnect();
			room = null;
			joinPromise = null;
			streams = [];
			volumes = {};
			localStream = { audioStream: null, videoStream: null };
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
		streams = [...streams, data];
	}

	function removeParticipant(participant) {
		streams = streams.filter((e) => e.id != participant.identity);
	}

	function srcObject(node, streams) {
		if (streams != null) {
			streams = streams.filter((x) => x != null);
			node.srcObject = new MediaStream(streams);
		}
		return {
			update(nextStreams) {
				if (nextStreams != null) {
					nextStreams = nextStreams.filter((x) => x != null);
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
		display: block;
		margin: auto auto;
	}
</style>

<div>
	{#if joinPromise == null}
		<button on:click={initialize}>Start Call</button>
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
											use:srcObject={[localStream.videoStream, localStream.audioStream]}
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
									on:click={toggleMute}>{#if muted}
										Unmute
									{:else}Mute{/if}</button>
								<button on:click={toggleVideo}>{#if videoHidden}
										Show video
									{:else}Stop video{/if}</button>
								<button on:click={endCall}>{#if room == null}
										Start Call
									{:else}End Call{/if}</button>
							</div>
						</div>
					</div>
				</div>
				<div
					class="sub container"
					style="flex: 1; display: flex; flex-wrap: wrap;">
					{#each streams as stream (stream.id)}
						<div class="remote">
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
							<span>{stream.id}</span>
							<button
								on:click={() => {
									mainStream = stream.videoStream.clone();
								}}>Pin</button>
						</div>
					{/each}
				</div>
			</div>
		{:catch error}
			<p>Failed to join room: {error.message}</p>
		{/await}
	{/if}
</div>
