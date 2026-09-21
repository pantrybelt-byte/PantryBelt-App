import os
import math
from PIL import Image, ImageDraw, ImageFilter

def create_mockup_assets(out_dir="/tmp/mockup_build"):
    os.makedirs(out_dir, exist_ok=True)
    
    W, H = 1920, 1080
    SW, SH = 444, 960
    SX, SY = (W - SW) // 2, (H - SH) // 2 # 738, 60
    BEZEL = 14
    BX, BY = SX - BEZEL, SY - BEZEL # 724, 46
    BW, BH = SW + BEZEL * 2, SH + BEZEL * 2 # 472, 988
    OUTER_R = 54
    INNER_R = 44
    
    # -------------------------------------------------------------
    # 1. SLIDE BACKGROUND (1920x1080)
    # -------------------------------------------------------------
    print("Generating slide background...")
    bg = Image.new("RGB", (W, H), (11, 13, 19))
    draw_bg = ImageDraw.Draw(bg)
    
    # Draw soft radial ambient glow behind the phone
    cx, cy = W // 2, H // 2
    max_radius = 850
    for r in range(max_radius, 0, -8):
        alpha = int(45 * (1.0 - (r / max_radius) ** 1.5))
        color = (18 + int(alpha * 0.4), 22 + int(alpha * 0.5), 32 + int(alpha * 0.7))
        draw_bg.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    
    bg = bg.filter(ImageFilter.GaussianBlur(15))
    bg.save(os.path.join(out_dir, "slide_bg.png"), quality=98)
    
    # -------------------------------------------------------------
    # 2. SCREEN ROUNDING MASK (444x960)
    # -------------------------------------------------------------
    print("Generating screen rounding mask...")
    # 4x supersampling for flawless antialiasing
    SCALE = 4
    mask_hi = Image.new("L", (SW * SCALE, SH * SCALE), 0)
    draw_mask = ImageDraw.Draw(mask_hi)
    draw_mask.rounded_rectangle([0, 0, SW * SCALE, SH * SCALE], radius=INNER_R * SCALE, fill=255)
    mask = mask_hi.resize((SW, SH), Image.Resampling.LANCZOS)
    mask.save(os.path.join(out_dir, "screen_mask.png"))
    
    # -------------------------------------------------------------
    # 3. 3D DROP SHADOW (1920x1080, RGBA)
    # -------------------------------------------------------------
    print("Generating 3D drop shadow...")
    shadow_canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    
    # Layer A: Deep contact shadow (dark, tighter)
    s_contact = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_sc = ImageDraw.Draw(s_contact)
    draw_sc.rounded_rectangle([BX + 6, BY + 18, BX + BW - 6, BY + BH + 18], radius=OUTER_R, fill=(0, 0, 0, 160))
    s_contact = s_contact.filter(ImageFilter.GaussianBlur(24))
    
    # Layer B: Wide ambient soft shadow
    s_ambient = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_sa = ImageDraw.Draw(s_ambient)
    draw_sa.rounded_rectangle([BX + 12, BY + 35, BX + BW - 12, BY + BH + 45], radius=OUTER_R, fill=(0, 0, 0, 110))
    s_ambient = s_ambient.filter(ImageFilter.GaussianBlur(60))
    
    # Layer C: Soft bottom floor bounce shadow
    s_floor = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_sf = ImageDraw.Draw(s_floor)
    draw_sf.rounded_rectangle([BX + 25, BY + 55, BX + BW - 25, BY + BH + 65], radius=OUTER_R, fill=(0, 0, 0, 80))
    s_floor = s_floor.filter(ImageFilter.GaussianBlur(95))
    
    # Composite shadows
    shadow_canvas = Image.alpha_composite(shadow_canvas, s_floor)
    shadow_canvas = Image.alpha_composite(shadow_canvas, s_ambient)
    shadow_canvas = Image.alpha_composite(shadow_canvas, s_contact)
    shadow_canvas.save(os.path.join(out_dir, "phone_shadow.png"))
    
    # -------------------------------------------------------------
    # 4. PHONE FRAME OVERLAY (1920x1080, RGBA)
    # -------------------------------------------------------------
    print("Generating phone chassis & bezel overlay...")
    # Render at 2x supersampling for high fidelity, then scale down
    S2 = 2
    W2, H2 = W * S2, H * S2
    BX2, BY2 = BX * S2, BY * S2
    BW2, BH2 = BW * S2, BH * S2
    SX2, SY2 = SX * S2, SY * S2
    SW2, SH2 = SW * S2, SH * S2
    OR2 = OUTER_R * S2
    IR2 = INNER_R * S2
    
    frame_hi = Image.new("RGBA", (W2, H2), (0, 0, 0, 0))
    d = ImageDraw.Draw(frame_hi)
    
    # Draw side buttons
    btn_color = (68, 70, 75, 255)
    btn_highlight = (110, 115, 125, 255)
    btn_shadow = (35, 36, 40, 255)
    
    # Buttons left: Action, Vol Up, Vol Down
    btn_w = 4 * S2
    buttons_left = [
        (BY2 + 110 * S2, 34 * S2), # Action
        (BY2 + 160 * S2, 60 * S2), # Vol Up
        (BY2 + 232 * S2, 60 * S2), # Vol Down
    ]
    for top_y, btn_h in buttons_left:
        bx = BX2 - btn_w
        d.rounded_rectangle([bx, top_y, BX2 + 2, top_y + btn_h], radius=2 * S2, fill=btn_color)
        d.line([(bx, top_y + 2), (bx, top_y + btn_h - 2)], fill=btn_highlight, width=1 * S2)
        d.line([(bx + btn_w, top_y), (bx + btn_w, top_y + btn_h)], fill=btn_shadow, width=1 * S2)
    
    # Button right: Power
    p_top, p_h = BY2 + 165 * S2, 85 * S2
    px = BX2 + BW2 - 2
    d.rounded_rectangle([px, p_top, px + btn_w + 2, p_top + p_h], radius=2 * S2, fill=btn_color)
    d.line([(px + btn_w, p_top + 2), (px + btn_w, p_top + p_h - 2)], fill=btn_highlight, width=1 * S2)
    d.line([(px, p_top), (px, p_top + p_h)], fill=btn_shadow, width=1 * S2)
    
    # Main Phone Chassis (Titanium rim + body)
    # Outer dark titanium bezel
    d.rounded_rectangle([BX2, BY2, BX2 + BW2, BY2 + BH2], radius=OR2, fill=(28, 28, 30, 255))
    
    # Metallic edge chamfer stroke (highlight)
    d.rounded_rectangle([BX2, BY2, BX2 + BW2, BY2 + BH2], radius=OR2, outline=(65, 67, 72, 255), width=int(1.5 * S2))
    
    # Subtle inner specular rim
    d.rounded_rectangle([BX2 + int(1.5*S2), BY2 + int(1.5*S2), BX2 + BW2 - int(1.5*S2), BY2 + BH2 - int(1.5*S2)], 
                        radius=OR2 - int(1.5*S2), outline=(42, 44, 48, 255), width=int(1 * S2))
    
    # Deep black inner display bezel
    d.rounded_rectangle([SX2 - 3*S2, SY2 - 3*S2, SX2 + SW2 + 3*S2, SY2 + SH2 + 3*S2], 
                        radius=IR2 + 3*S2, fill=(10, 10, 12, 255))
    
    # Screen cutout mask (make screen area transparent so video shows through)
    screen_cutout = Image.new("L", (W2, H2), 255)
    d_cut = ImageDraw.Draw(screen_cutout)
    d_cut.rounded_rectangle([SX2, SY2, SX2 + SW2, SY2 + SH2], radius=IR2, fill=0)
    
    # Apply cutout to frame alpha channel
    r, g, b, a = frame_hi.split()
    # combine existing alpha with cutout
    import numpy as np
    a_arr = np.array(a, dtype=np.uint16)
    c_arr = np.array(screen_cutout, dtype=np.uint16)
    new_a = (a_arr * c_arr // 255).astype(np.uint8)
    a_clean = Image.fromarray(new_a)
    frame_hi.putalpha(a_clean)
    
    # Add subtle inner screen bezel specular border
    d_hi = ImageDraw.Draw(frame_hi)
    d_hi.rounded_rectangle([SX2 - 1*S2, SY2 - 1*S2, SX2 + SW2 + 1*S2, SY2 + SH2 + 1*S2], 
                           radius=IR2 + 1*S2, outline=(55, 58, 64, 180), width=1*S2)
    
    # Downsample to 1x
    frame = frame_hi.resize((W, H), Image.Resampling.LANCZOS)
    frame.save(os.path.join(out_dir, "phone_frame.png"))
    
    # -------------------------------------------------------------
    # 5. DIAGONAL GLASS REFLECTION OVERLAY (Optional shine)
    # -------------------------------------------------------------
    print("Generating glass reflection overlay...")
    glass_hi = Image.new("RGBA", (W2, H2), (0, 0, 0, 0))
    d_glass = ImageDraw.Draw(glass_hi)
    
    # Draw soft subtle diagonal gloss band across the upper-right screen
    # Clip only to screen area
    polygon = [
        (SX2 + int(SW2 * 0.45), SY2),
        (SX2 + SW2, SY2),
        (SX2 + SW2, SY2 + int(SH2 * 0.42)),
        (SX2 + int(SW2 * 0.15), SY2 + int(SH2 * 0.85)),
        (SX2, SY2 + int(SH2 * 0.68)),
        (SX2, SY2 + int(SH2 * 0.28)),
    ]
    d_glass.polygon(polygon, fill=(255, 255, 255, 8))
    glass_hi = glass_hi.filter(ImageFilter.GaussianBlur(8 * S2))
    
    # Mask glass strictly to screen
    screen_only_mask = Image.new("L", (W2, H2), 0)
    d_som = ImageDraw.Draw(screen_only_mask)
    d_som.rounded_rectangle([SX2, SY2, SX2 + SW2, SY2 + SH2], radius=IR2, fill=255)
    
    gr, gg, gb, ga = glass_hi.split()
    ga_arr = np.array(ga, dtype=np.uint16)
    som_arr = np.array(screen_only_mask, dtype=np.uint16)
    glass_a = (ga_arr * som_arr // 255).astype(np.uint8)
    glass_hi.putalpha(Image.fromarray(glass_a))
    
    glass = glass_hi.resize((W, H), Image.Resampling.LANCZOS)
    glass.save(os.path.join(out_dir, "glass_reflection.png"))
    
    print("All mockup graphics successfully generated in", out_dir)

if __name__ == "__main__":
    create_mockup_assets()
