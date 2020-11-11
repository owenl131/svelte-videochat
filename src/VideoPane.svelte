<script>
    import IoIosExpand from "svelte-icons/io/IoIosExpand.svelte";
    import IoMdSwap from "svelte-icons/io/IoMdSwap.svelte";
    import MdGraphicEq from "svelte-icons/md/MdGraphicEq.svelte";
    import IoIosVolumeOff from "svelte-icons/io/IoIosVolumeOff.svelte";

    export let buttonClickAudio = undefined;
    export let pinPressed = null;
    export let rotateVideos = null;

    export let videoStreams = [];
    export let audioStreams = [];
    export let muted = false;
    export let mainId = null;
    export let id = "";
    export let volume = 0;
    export let framed = false;

    const unitSquare =
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

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
    .noselect {
        -webkit-touch-callout: none; /* iOS Safari */
        -webkit-user-select: none; /* Safari */
        -khtml-user-select: none; /* Konqueror HTML */
        -moz-user-select: none; /* Old versions of Firefox */
        -ms-user-select: none; /* Internet Explorer/Edge */
        user-select: none; /* Non-prefixed version, currently
                                  supported by Chrome, Edge, Opera and Firefox */
    }
    * {
        margin: 0;
    }
    .video-outer > img {
        width: calc(3 / 4 * 100%);
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
        max-width: 100%;
        max-height: 100%;
        width: 100%;
        height: 100%;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        -ms-transform: translate(-50%, -50%);
    }
    .icon-button {
        display: flex;
        align-content: center;
        margin: 3px 2px;
        line-height: initial;
        padding: 2px 10px;
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
    .frame {
        position: absolute;
        height: calc(100% - 6px);
        width: calc(100% - 6px);
        border-width: 3px;
        border-style: inset;
        border-color: yellow;
        z-index: 20;
    }
</style>

<div class="remote" style="position: relative;">
    {#if framed}
        <div class="frame" />
    {/if}
    <div class="video-outer">
        <img class="noselect" src={unitSquare} alt="backing" />
        <div class="video-contents">
            <video
                use:srcObject={chooseWhich(videoStreams, audioStreams, mainId === id)}
                autoplay>
                <track kind="captions" /></video>
            <div style="height: 100%; position: absolute; top: 0; left: 0">
                <img
                    class="noselect"
                    src={unitSquare}
                    alt="backing"
                    style="height: 100%" />
            </div>
        </div>
    </div>
    <div
        style="position: absolute; bottom: 3px; right: 3px;
            background-color: rgba(0, 0, 0, 0.4);
            display: flex; justify-content: center;">
        <span style="color: white; margin-left: 3px; align-self: center">{id}
        </span>
        {#if muted}
            <div
                style="height: 20px; width: 20px; margin: 3px; display: inline-block; color: white; align-self: center">
                <IoIosVolumeOff />
            </div>
        {/if}
        {#if pinPressed}
            <button
                class="icon-button"
                title="Click to maximise video"
                on:click={() => {
                    buttonClickAudio.play();
                    pinPressed(id);
                }}><div class="icon" style="margin-right: 0">
                    <IoIosExpand />
                </div></button>
        {/if}
        {#if videoStreams.length > 1 && rotateVideos}
            <button
                class="icon-button"
                title="Switch between screen share and camera"
                on:click={() => {
                    buttonClickAudio.play();
                    rotateVideos();
                }}><div class="icon" style="margin-right: 0">
                    <IoMdSwap />
                </div></button>
        {/if}
        <div
            style="color: white; margin-left: 3px; align-self: center;
                height: 20px; width: 20px; transform: scaleY({Math.min(volume / 0.3, 1) + 0.1})">
            <MdGraphicEq />
        </div>
    </div>
</div>
