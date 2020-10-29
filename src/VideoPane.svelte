<script>
    import IoIosExpand from "svelte-icons/io/IoIosExpand.svelte";
    import IoMdSwap from "svelte-icons/io/IoMdSwap.svelte";
    import MdGraphicEq from "svelte-icons/md/MdGraphicEq.svelte";
    import IoIosVolumeOff from "svelte-icons/io/IoIosVolumeOff.svelte";

    export let buttonClickAudio = undefined;

    export let videoStreams = [];
    export let audioStreams = [];
    export let muted = false;
    export let mainId = null;
    export let mainPinned = false;
    export let id = "";
    export let volume = 0;

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
            destroy() {},
        };
    }

    function chooseWhich(vids, auds, main) {
        if (main) {
            if (vids.length == 1) {
                return [...vids, ...auds];
            }
            return [...vids.slice(1), ...auds];
        }
        return [...vids, ...auds];
    }
</script>

<style>
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
</style>

<div class="remote" style="position: relative;">
    <div class="video-outer">
        <img
            src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
            alt="backing" />
        <div class="video-contents">
            <video
                use:srcObject={chooseWhich(videoStreams, audioStreams, mainId === id)}
                autoplay>
                <track kind="captions" /></video>
            <div style="height: 100%; position: absolute; top: 0; left: 0">
                <img
                    src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
                    alt="backing"
                    style="height: 100%" />
            </div>
        </div>
    </div>
    <div
        style="position: absolute; bottom: 0; right: 0; background-color: rgba(0, 0, 0, 0.4); display: flex; justify-content: center;">
        <span style="color: white; margin: auto 5px;">{id} </span>
        {#if muted}
            <div style="height: 20px; width: 20px; display: inline-block">
                <IoIosVolumeOff />
            </div>
        {/if}
        <button
            style="padding: 0 10px; display: flex; justify-content: center"
            title="Click to maximise video"
            on:click={() => {
                buttonClickAudio.play();
                if (videoStreams.length >= 1) {
                    mainPinned = true;
                    mainId = id;
                }
            }}><div class="icon" style="margin-right: 0">
                <IoIosExpand />
            </div></button>
        {#if videoStreams.length > 1}
            <button
                style="padding: 0 10px; display: flex; justify-content: center"
                title="Switch between screen share and camera"
                on:click={() => {
                    buttonClickAudio.play();
                    videoStreams = [...videoStreams.slice(1), ...videoStreams.slice(0, 1)];
                }}><div class="icon" style="margin-right: 0">
                    <IoMdSwap />
                </div></button>
            <div
                style="color: white; height: 20px; width: 20px; transform: scaleY({Math.min(volume / 0.3, 1) + 0.1})">
                <MdGraphicEq />
            </div>
        {/if}
    </div>
</div>
