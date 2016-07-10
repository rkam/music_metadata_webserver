#!/bin/bash
set -uo pipefail

PROTO=http
HOST=localhost
PORT=8060           ## NOTE: this is the development, not production, port

ALBUM_ART_DIR="music/albumart"
DEFAULT_ALBUM_ART="$ALBUM_ART_DIR/default_art_ngc891_300x300.jpg"
EXISTING_ALBUM_ART_PNG="$ALBUM_ART_DIR/300/png/Adele__25.png"

TEST_CONN_URL_PATH=index.html

DATA=

VERBOSE=0
while [[ $# -gt 0 ]];
do
  case $1 in
    '-?')
      # shellcheck disable=2086
      echo "Usage: $(basename $0) -v [-v ...]"
      exit 0
      ;;

    -v) (( VERBOSE +=1 )) ; shift ;;

    -p) PORT=$2; shift 2 ;;

    *) echo "Unknown arg ($1) -- ignoring" ; shift ;;

  esac
done

FIRST=1
echo 'Checking connectivity...'
curl -s "$PROTO://$HOST:$PORT/$TEST_CONN_URL_PATH" > /dev/null
while [[ $? -ne 0 ]]
do
  ANS=
  if [[ $FIRST -eq 1 ]]; then
    FIRST=0
    echo "Cannot connect..."
    echo -e "Start the server (on port $PORT)"
    read -rp  "[ Enter to continue ; q to exit ] (make sure iTunes is playing) " ANS
  else
    read -rp "Cannot connect... " ANS
  fi
  [[ $ANS == q ]] && exit 0
  curl -s "$PROTO://$HOST:$PORT/$TEST_CONN_URL_PATH" > /dev/null
done
unset FIRST TEST_CONN_URL_PATH
echo ""


ANY_FAIL=0

do_test()
{
  TEST="$1"
  URL_PATH="$2"
  HANDLE_DIFF="${3:-0}"
  ADD_NL="${4:-0}"

  OUT_FILE="_test_data/$$_${TEST}.xxx"
  TEST_FILE="_test_data/sample_${TEST}_data.xxx"

#echo curl -s "$PROTO://$HOST:$PORT/$URL_PATH" INTO "$OUT_FILE"
#return

  [[ $VERBOSE -gt 1 ]] && set -x
  if [[ -z $DATA ]]; then
    curl -s            "$PROTO://$HOST:$PORT/$URL_PATH" > "$OUT_FILE"
  else
    curl -s -d "$DATA" "$PROTO://$HOST:$PORT/$URL_PATH" > "$OUT_FILE"
  fi
  RET=$? ; WHY=" curl failed"
  [[ $VERBOSE -gt 1 ]] && set +x

  [[ $VERBOSE -gt 2 ]] && echo "curl RET=$RET"

  [[ ! -s "$OUT_FILE" ]] && RET=1 ; WHY=" empty file"
  [[ $VERBOSE -gt 2 ]] && echo "-s RET=$RET"

  [[ $ADD_NL != 0 ]] && echo "" >> "$OUT_FILE"

  if [[ $HANDLE_DIFF == 0 ]]; then
    # Normal diff
    if [[ $RET == 0 ]]; then
      diff -q  "$OUT_FILE" "$TEST_FILE" > /dev/null 2>&1
      RET=$? ; WHY=" output different"
      if [[ $RET -ne 0 && "$TEST" =~ music_summary_test_v[0-9]  ]]; then
        json_pp < "$OUT_FILE"  | sort > "$OUT_FILE"_v
        json_pp < "$TEST_FILE" | sort > "$TEST_FILE"_v

        echo ""
        echo "diff ${OUT_FILE}_v ${TEST_FILE}_v"
        echo "# cp $OUT_FILE $TEST_FILE"
      fi
      [[ $VERBOSE -gt 2 ]] && echo "diff RET=$RET"
    fi
  elif [[ $HANDLE_DIFF == 1 ]]; then
    # Ignore diff
    :
  elif [[ $HANDLE_DIFF == 2 ]]; then
    # Handle diff of just JSON keys
    tr ',' '\n' < "$OUT_FILE" | sed -e 's/:.*$//' > "$OUT_FILE"2
    mv "$OUT_FILE"2 "$OUT_FILE"
    if [[ $RET == 0 ]]; then
      diff -q  "$OUT_FILE" "$TEST_FILE" > /dev/null 2>&1
      RET=$? ; WHY=" output different"
      if [[ $RET != 0 ]]; then
        # Loved and Year could be unset and hence no key
        sed -e '/TitleWithYear/d' -e '/Year/d' -e '/Loved/d' "$TEST_FILE" > "$OUT_FILE"2
        diff -q  "$OUT_FILE" "$OUT_FILE"2 > /dev/null 2>&1
        RET=$? ; WHY=" output different (ignoring TitleWithYear and Year/Loved)"

        echo ""
        echo "diff ${OUT_FILE} ${TEST_FILE}"
      fi
      [[ $VERBOSE -gt 2 ]] && echo "diff RET=$RET"
    fi
  fi

  # shellcheck disable=2086
  if [[ $RET == 0 ]]; then
    [[ $VERBOSE -gt 0 ]] && echo "$TEST: PASS"
    rm -f "$OUT_FILE" "$OUT_FILE"2
  else
    [[ $VERBOSE -gt 0 ]] && echo "$TEST: FAIL -- $WHY"
    (( ANY_FAIL += 1 ))
  fi
}

do_get_test()
{
  # shellcheck disable=2068
  do_test $@
}

do_post_test()
{
#do_post_test music_cmd         music/controller?action=playpause
#  curl -d '{ "action": "playpause" }' localhost:8069/music/controller/1.1
  :
}

do_fail_diff()
{
  # shellcheck disable=2068
  do_test $@ 1
}

do_fail_test()
{
  :
}

do_keys_diff()
{
  # shellcheck disable=2068
  do_test $@ 2
}

# DEBUG
do_get_test base               get
do_post_test post_base         post

# BASE
##TODO will need to fix this when have actual static pages
do_get_test any_html1          index.html
do_get_test any_html2          foo.html

# MUSIC #######################################################################
# GET
do_get_test music_summary_test_v1  music/test/0.1 0 1
do_get_test music_summary_test_v2  music/test/0.2 0 1
do_get_test music_summary_test_v3  music/test/0.3 0 1
do_get_test music_summary_test     music/test     0 1

#do_fail_diff music_root        music                   ## ##TODO: ENOIMPL -- tries to read file and that aborts if ENOEXIST (and need to dig (a lot) for  why)
do_fail_diff music_summary     music/summary
DATA=accurate
do_fail_diff music_accurate    music/summary
DATA=
do_fail_diff music_summary_v1  music/summary/0.1
do_fail_diff music_summary_v2  music/summary/0.2
do_fail_diff music_summary_v3  music/summary/0.3

do_fail_diff image_png         "$EXISTING_ALBUM_ART_PNG"
do_fail_diff image_jpg         "$DEFAULT_ALBUM_ART"

do_keys_diff music_summary_jsonkeys music/summary
do_keys_diff music_summary_jsonkeys_v1 music/summary
do_keys_diff music_summary_jsonkeys_v2 music/summary
do_keys_diff music_summary_jsonkeys_v3 music/summary

# POST
do_post_test music_cmd         music/controller?action=playpause
do_post_test music_cmd         music/controller?action=playpause

# FAILS
do_fail_test fail_base        ##??_music/summary

if [[ $ANY_FAIL == 0 ]]; then
  echo "ALL PASS"
else
  echo -e "\nFAIL (use -v to see which)"
fi

# vim:ts=2:sw=2:sts=2:et:colorcolumn=80
