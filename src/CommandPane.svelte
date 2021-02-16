<script>
    import { Confirm } from "svelte-confirm";
    import SvelteTooltip from "svelte-tooltip";
    import IoIosVolumeOff from "svelte-icons/io/IoIosVolumeOff.svelte";
    import IoIosVolumeHigh from "svelte-icons/io/IoIosVolumeHigh.svelte";
    import FaVideoSlash from "svelte-icons/fa/FaVideoSlash.svelte";
    import IoMdEyeOff from "svelte-icons/io/IoMdEyeOff.svelte";
    import IoMdEye from "svelte-icons/io/IoMdEye.svelte";
    import IoMdCall from "svelte-icons/io/IoMdCall.svelte";
    import MdScreenShare from "svelte-icons/md/MdScreenShare.svelte";
    import MdStopScreenShare from "svelte-icons/md/MdStopScreenShare.svelte";
    import MdBrandingWatermark from "svelte-icons/md/MdBrandingWatermark.svelte";
    import MdApps from "svelte-icons/md/MdApps.svelte";

    export let layout = "main";
    export let isMuted = false;
    export let isVideoHidden = false;
    export let isScreenShared = false;

    export let toggleView = null;
    export let toggleMute = null;
    export let toggleVideo = null;
    export let toggleScreenShare = null;
    export let endCall = null;
</script>

<Confirm let:confirm={confirmThis}>
    <div class="commandContainer">
        <style>
            .tooltip.top {
                top: 0;
            }
        </style>
        <!-- Layout -->
        <SvelteTooltip
            tip={layout === "main" ? "Gallery View" : "Main Speaker View"}
            top
            color="white"
        >
            <button class="icon-button" on:click={toggleView}
                >{#if layout === "main"}
                    <div class="icon">
                        <MdApps />
                    </div>
                {:else}
                    <div class="icon">
                        <MdBrandingWatermark />
                    </div>
                {/if}</button
            >
        </SvelteTooltip>
        <!-- Mute -->
        <SvelteTooltip tip={isMuted ? "Unmute" : "Mute"} top color="white">
            <button
                class="icon-button"
                on:click={toggleMute}
                style={isMuted ? "background: red; color: white" : ""}
                >{#if isMuted}
                    <div class="icon" style="color: white">
                        <IoIosVolumeHigh />
                    </div>
                {:else}
                    <div class="icon">
                        <IoIosVolumeOff />
                    </div>
                {/if}</button
            >
        </SvelteTooltip>
        <!-- Turn video on/off -->
        <SvelteTooltip
            tip={isVideoHidden ? "Show video" : "Stop video"}
            top
            color="white"
        >
            <button
                class="icon-button"
                style={isVideoHidden ? "background: red; color: white" : ""}
                on:click={toggleVideo}
                >{#if isVideoHidden}
                    <div class="icon">
                        <IoMdEye />
                    </div>
                {:else}
                    <div
                        class="icon"
                        style={isVideoHidden ? "color: white" : ""}
                    >
                        <IoMdEyeOff />
                    </div>
                {/if}</button
            >
        </SvelteTooltip>
        <!-- Screen sharing -->
        <SvelteTooltip
            tip={isScreenShared ? "Unshare screen" : "Share screen"}
            top
            color="white"
        >
            <button class="icon-button" on:click={toggleScreenShare}>
                <div class="icon">
                    {#if isScreenShared}
                        <MdStopScreenShare />
                    {:else}
                        <MdScreenShare />
                    {/if}
                </div></button
            >
        </SvelteTooltip>
        <!-- End call, request confirmation if there are other users in the call -->
        <SvelteTooltip tip={"End Call"} top color="white">
            <button class="icon-button" on:click={() => confirmThis(endCall)}
                ><div class="icon" style="color: red">
                    <FaVideoSlash />
                </div></button
            >
        </SvelteTooltip>
    </div>
    <span slot="title"> End Call </span>
    <span slot="description"> Are you sure you want to end the call? </span>
</Confirm>

<!-- End control panel -->
<style>
    .commandContainer {
        position: fixed;
        bottom: 50px;
        left: 50vw;
        transform: translateX(-50%);
        display: flex;
        flex-direction: row;
        justify-content: center;
        z-index: 40;
    }
    .icon {
        display: inline-block;
        color: gray;
        width: 24px;
        height: 24px;
        align-self: center;
    }
    .icon-button {
        background-color: white;
        display: flex;
        flex-direction: row;
        align-content: center;
        justify-content: center;
        margin: 0 4px;
        line-height: initial;
        padding: 0;
        border-radius: 50%;
        width: 56px;
        height: 56px;
        box-shadow: 1px 1px 10px 1px black;
    }
    @media screen and (max-width: 640px) {
        .icon-button {
            margin: 0 2px;
            width: 48px;
            height: 48px;
        }
        .icon {
            width: 20px;
            height: 20px;
        }
        .commandContainer {
            bottom: 20px;
        }
    }
</style>
